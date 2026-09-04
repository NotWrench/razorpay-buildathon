import { agentDb, aiRecommendations } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { getFrequentlyBoughtWith } from "../analytics";
import { AuditAction, auditActorType, recordAudit } from "../audit";
import {
  describeCatalogScope,
  getProductById,
  getProductsByIds,
  searchCatalog,
  toModelProduct,
} from "../catalog";
import { compareProducts } from "../compare";
import type { AgentContext } from "../context";
import { describeMemories, recallMemories, rememberMemory } from "../memory";
import { formatPaise, rupeesToPaise } from "../money";
import { quoteCart } from "../quote";
import { optional } from "./schema";

/**
 * Discovery, recommendation and pricing tools.
 *
 * None of these move money. Each closes over the request-scoped context, so the
 * model chooses products and quantities and nothing else — merchant, buyer
 * identity and every price come from the server.
 */
export function shoppingTools(ctx: AgentContext) {
  const actorType = auditActorType(ctx.actor.type);

  return {
    compareProducts: tool({
      description:
        "Compare 2-4 products from this store side by side. Returns a table " +
        "of the attributes their category actually publishes, with which one " +
        "leads each row and by how much. Use this for every comparison — the " +
        "numbers come from the catalog, and yours do not. An attribute " +
        "nothing publishes is left out rather than guessed at; say so when " +
        "the buyer asks about one.",
      execute: async ({ productIds }) => {
        const result = await compareProducts(ctx.merchantId, productIds);

        if (result.products.length < 2) {
          return {
            error:
              "Fewer than two of those products are in this store, so there is nothing to compare.",
            found: result.products.length,
          };
        }

        await recordAudit({
          action: AuditAction.AGENT_SEARCH,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Compared ${result.products.map((product) => product.name).join(" vs ")}`,
          merchantId: ctx.merchantId,
          metadata: { productIds },
        });

        return result;
      },
      inputSchema: z.object({
        productIds: z.array(z.uuid()).min(2).max(4),
      }),
    }),

    getProduct: tool({
      description: "Full detail and live stock for one product.",
      execute: async ({ productId }) => {
        const product = await getProductById(ctx.merchantId, productId);

        if (!product) {
          return { error: "That product is not in this store.", found: false };
        }

        return { found: true, product: toModelProduct(product) };
      },
      inputSchema: z.object({ productId: z.uuid() }),
    }),

    quoteOrder: tool({
      description:
        "Price a cart and show the full breakdown: line items, subtotal, any " +
        "active campaign discount, and the total. Charges nothing and creates " +
        "nothing. ALWAYS call this and show the result before proposing to " +
        "create an order.",
      execute: async ({ items }) => {
        const quote = await quoteCart(ctx, items);

        await recordAudit({
          action: AuditAction.AGENT_QUOTED,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Quoted ${quote.lines.length} line item(s) at ${formatPaise(quote.totalPaise)}`,
          merchantId: ctx.merchantId,
          metadata: {
            appliedCampaign: quote.appliedCampaign?.title ?? null,
            discountPaise: quote.discountPaise,
            subtotalPaise: quote.subtotalPaise,
            totalPaise: quote.totalPaise,
          },
        });

        return quote;
      },
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              isUpsell: z.boolean().default(false),
              productId: z.uuid(),
              quantity: z.number().int().min(1).max(10),
            })
          )
          .min(1)
          .max(20),
      }),
    }),

    recallPreferences: tool({
      description:
        "What is already known about this buyer from previous visits. Call " +
        "this early when the request is vague.",
      execute: async () => {
        const memories = await recallMemories(ctx);

        return { memories, summary: describeMemories(memories) };
      },
      inputSchema: z.object({}),
    }),

    recommendProducts: tool({
      description:
        "Record what you are recommending. Every item needs a bestFit: the " +
        "product that most directly meets what the buyer actually asked for, " +
        "within their budget. Add an upgrade ONLY when spending more buys " +
        "something the buyer specifically said they need — you must name the " +
        "stated requirement it serves. If you cannot name one, there is no " +
        "upgrade to offer, and leaving it out is the correct answer. A more " +
        "powerful part is not by itself a reason.",
      execute: async ({ recommendations }) => {
        // Resolve every referenced product in one query, then write the
        // recommendations in one insert: a per-item round trip would put the
        // whole agent turn behind N database calls.
        const found = await getProductsByIds(
          ctx.merchantId,
          recommendations.flatMap((item) =>
            item.upgrade
              ? [item.bestFit.productId, item.upgrade.productId]
              : [item.bestFit.productId]
          )
        );

        const valid = recommendations.filter((item) =>
          found.has(item.bestFit.productId)
        );

        const rows = valid.flatMap((item) => {
          const bestFit = found.get(item.bestFit.productId);
          const upgradeProduct = item.upgrade
            ? found.get(item.upgrade.productId)
            : undefined;

          const base = {
            confidenceScore: item.bestFit.confidence,
            conversationId: ctx.conversationId,
            productId: item.bestFit.productId,
            reason: item.bestFit.reason,
            recommendationType: "best_fit" as const,
          };

          if (!(item.upgrade && upgradeProduct && bestFit)) {
            return [base];
          }

          // The price gap is computed from catalog rows, never taken from the
          // model. "Only 2,000 more" has to be true, and §19 puts the
          // arithmetic behind any number the buyer acts on on the server.
          const additionalSpendPaise = upgradeProduct.price - bestFit.price;

          // An upgrade that costs nothing more is not an upgrade, and the
          // check constraint would refuse it anyway.
          if (additionalSpendPaise <= 0) {
            return [base];
          }

          return [
            base,
            {
              additionalSpendPaise,
              confidenceScore: item.upgrade.confidence,
              conversationId: ctx.conversationId,
              productId: item.upgrade.productId,
              reason: item.upgrade.benefit,
              recommendationType: "upgrade" as const,
              replacesProductId: item.bestFit.productId,
              tiedToRequirement: item.upgrade.tiedToRequirement,
            },
          ];
        });

        if (rows.length > 0) {
          await agentDb.insert(aiRecommendations).values(rows);
        }

        const stored = valid.map(
          (item) =>
            found.get(item.bestFit.productId)?.name ?? item.bestFit.productId
        );

        const upgrades = rows.filter(
          (row) => row.recommendationType === "upgrade"
        );

        await recordAudit({
          action: AuditAction.AGENT_RECOMMENDED,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Recommended ${stored.length} product(s): ${stored.join(", ")}${upgrades.length > 0 ? ` with ${upgrades.length} upgrade(s)` : " with no upgrade offered"}`,
          merchantId: ctx.merchantId,
          metadata: { recommendations },
        });

        return {
          // Every product this recommendation refers to, named and priced from
          // the catalog. The reasons and confidences are the model's and stay
          // on the tool input; a name and a price are facts, and the card that
          // renders this must read them from here rather than from anything
          // the model retyped.
          products: [...found.values()].map((product) => ({
            name: product.name,
            pricePaise: product.price,
            productId: product.id,
          })),
          recorded: stored.length,
          // Echoed back so the model quotes the server's arithmetic rather
          // than restating its own guess at the gap.
          upgrades: upgrades.map((row) => ({
            additionalSpendPaise: row.additionalSpendPaise,
            productId: row.productId,
            tiedToRequirement: row.tiedToRequirement,
          })),
        };
      },
      inputSchema: z.object({
        recommendations: z
          .array(
            z.object({
              bestFit: z.object({
                confidence: z
                  .number()
                  .min(0)
                  .max(1)
                  .describe("0-1. Be honest — a weak match should score low."),
                productId: z.uuid(),
                reason: z
                  .string()
                  .min(15)
                  .max(500)
                  .describe(
                    "Why this product, tied to what the buyer actually asked for."
                  ),
              }),
              upgrade: optional(
                z.object({
                  benefit: z
                    .string()
                    .min(15)
                    .max(500)
                    .describe(
                      "What the extra spend actually buys them, concretely."
                    ),
                  confidence: z.number().min(0).max(1),
                  productId: z.uuid(),
                  tiedToRequirement: z
                    .string()
                    .min(5)
                    .max(300)
                    .describe(
                      "The requirement the buyer stated that this serves, in " +
                        "their words. If you cannot name one, omit the whole " +
                        "upgrade — that is the right answer, not a failure."
                    ),
                })
              ),
            })
          )
          .min(1)
          .max(6),
      }),
    }),

    rememberPreference: tool({
      description:
        "Store a durable fact about this buyer — a preferred brand, a typical " +
        "budget, a favourite category. Only for things that will still be true " +
        "next visit, never for this conversation's passing details.",
      execute: async ({ importance, key, value }) => {
        await rememberMemory(ctx, {
          importanceScore: importance,
          memoryKey: key,
          memoryValue: value,
        });

        await recordAudit({
          action: AuditAction.MEMORY_WRITTEN,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Remembered ${key} = ${value}`,
          merchantId: ctx.merchantId,
          metadata: { key, value },
        });

        return { remembered: true };
      },
      inputSchema: z.object({
        importance: z.number().min(0).max(1).default(0.5),
        key: z
          .string()
          .min(2)
          .max(60)
          .describe("Stable snake_case key, e.g. preferred_brand"),
        value: z.string().min(1).max(300),
      }),
    }),
    searchProducts: tool({
      description:
        "Search this store's catalog. Use it before recommending anything — " +
        "never invent products, prices or stock levels. An empty result is a " +
        "real answer: it means this store does not sell that, and the reply " +
        "returns what it does sell so you can say so and offer something " +
        "genuinely relevant. Do not retry the same search hoping for a " +
        "different list.",
      execute: async ({ budgetMaxRupees, category, limit, query }) => {
        /*
         * Converted here, never by the model. Asked to turn rupees into paise
         * it drops or adds a zero — an observed ₹1,25,000 budget reached the
         * build assembler as ₹12,500 — and a price filter an order of
         * magnitude out returns a plausible-looking page of the wrong parts.
         * See `tools/schema.ts` for the other half of this lesson.
         */
        const budgetMaxPaise =
          budgetMaxRupees === undefined
            ? undefined
            : rupeesToPaise(budgetMaxRupees);

        const result = await searchCatalog(ctx.merchantId, {
          budgetMaxPaise,
          category,
          limit,
          query,
        });

        await recordAudit({
          action: AuditAction.AGENT_SEARCH,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Searched the catalog for "${query}"${budgetMaxPaise ? ` under ${formatPaise(budgetMaxPaise)}` : ""} and found ${result.products.length} match(es)`,
          merchantId: ctx.merchantId,
          metadata: {
            budgetMaxPaise,
            category,
            query,
            strategy: result.strategy,
          },
        });

        if (result.products.length > 0) {
          return {
            products: result.products.map((row) => ({
              ...toModelProduct(row.product),
              matchScore: Number(row.score.toFixed(3)),
            })),
            strategy: result.strategy,
          };
        }

        // Nothing matched, so hand back the shape of the store rather than an
        // empty list. Without this the model has no grounded way to answer,
        // and either apologises and stops or reaches for what it remembers
        // about shops in general — both of which §19 forbids.
        const scope = await describeCatalogScope(ctx.merchantId);

        return {
          note: `No product in this store matches "${query}"${budgetMaxPaise ? ` under ${formatPaise(budgetMaxPaise)}` : ""}. Tell the buyer plainly that this store does not sell it, name what it does sell, and offer the nearest thing that genuinely serves what they asked for. Do not search again for the same thing.`,
          products: [],
          storeSells: scope.categories.map((row) => ({
            category: row.category,
            fromPaise: row.fromPaise,
            products: row.count,
          })),
          strategy: result.strategy,
        };
      },
      inputSchema: z.object({
        budgetMaxRupees: optional(z.number().positive()).describe(
          "Upper price limit in rupees, exactly as the buyer said it. 5000 " +
            "for ₹5,000 — do not convert to paise."
        ),
        category: optional(z.string().max(80)).describe(
          "Narrow to one catalog category. This store uses short trade " +
            "names — gpu, cpu, motherboard, ram, storage, psu, cooler, " +
            "case, fan, monitor, peripheral — though common English names " +
            'such as "graphics card" are understood too. Omit it unless ' +
            "the buyer clearly wants one kind of part; the query alone " +
            "already searches every category."
        ),
        limit: z.number().int().min(1).max(12).default(6),
        query: z
          .string()
          .min(2)
          .max(300)
          .describe("What the buyer is looking for, in their own words."),
      }),
    }),

    suggestUpsell: tool({
      description:
        "Find what real buyers bought alongside a product. Use this for " +
        "add-ons and bundles instead of guessing — it returns measured " +
        "attach rates from this store's own order history.",
      execute: async ({ productId }) => {
        const attachments = await getFrequentlyBoughtWith(
          ctx.merchantId,
          productId,
          5
        );

        const found = await getProductsByIds(
          ctx.merchantId,
          attachments.map((attachment) => attachment.attachedProductId)
        );

        const suggestions = attachments.flatMap((attachment) => {
          const product = found.get(attachment.attachedProductId);

          // Never suggest something the buyer cannot actually add.
          if (!product || product.stock <= 0) {
            return [];
          }

          return [
            {
              ...toModelProduct(product),
              attachRate: Number(attachment.attachRate.toFixed(3)),
              evidence: `Bought together in ${attachment.coOccurringOrders} of ${attachment.anchorOrders} orders containing ${attachment.anchorName}`,
            },
          ];
        });

        return {
          note:
            suggestions.length === 0
              ? "No co-purchase history yet. Suggest a complement from the catalog on merit, and say that it is a suggestion rather than a pattern."
              : undefined,
          suggestions,
        };
      },
      inputSchema: z.object({
        productId: z.uuid().describe("The product already in the cart."),
      }),
    }),
  } satisfies ToolSet;
}
