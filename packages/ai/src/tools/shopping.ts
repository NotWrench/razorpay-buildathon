import { agentDb, aiRecommendations } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { getFrequentlyBoughtWith } from "../analytics";
import { AuditAction, auditActorType, recordAudit } from "../audit";
import {
  getProductById,
  getProductsByIds,
  searchCatalog,
  toModelProduct,
} from "../catalog";
import type { AgentContext } from "../context";
import { describeMemories, recallMemories, rememberMemory } from "../memory";
import { formatPaise } from "../money";
import { quoteCart } from "../quote";

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
        "Record the products you are recommending, each with the reason it " +
        "fits and how confident you are. Call this whenever you present " +
        "options, so the recommendation is on the record and auditable.",
      execute: async ({ recommendations }) => {
        // Resolve every referenced product in one query, then write the
        // recommendations in one insert: a per-item round trip would put the
        // whole agent turn behind N database calls.
        const found = await getProductsByIds(
          ctx.merchantId,
          recommendations.map((item) => item.productId)
        );

        const valid = recommendations.filter((item) =>
          found.has(item.productId)
        );
        const stored = valid.map(
          (item) => found.get(item.productId)?.name ?? item.productId
        );

        if (valid.length > 0) {
          await agentDb.insert(aiRecommendations).values(
            valid.map((item) => ({
              confidenceScore: item.confidence,
              conversationId: ctx.conversationId,
              productId: item.productId,
              reason: item.reason,
              recommendationType: "search_result" as const,
            }))
          );
        }

        await recordAudit({
          action: AuditAction.AGENT_RECOMMENDED,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: `Recommended ${stored.length} product(s): ${stored.join(", ")}`,
          merchantId: ctx.merchantId,
          metadata: { recommendations },
        });

        return { recorded: stored.length };
      },
      inputSchema: z.object({
        recommendations: z
          .array(
            z.object({
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
        "never invent products, prices or stock levels.",
      execute: async ({ budgetMaxPaise, category, limit, query }) => {
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

        return {
          products: result.products.map((row) => ({
            ...toModelProduct(row.product),
            matchScore: Number(row.score.toFixed(3)),
          })),
          strategy: result.strategy,
        };
      },
      inputSchema: z.object({
        budgetMaxPaise: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Upper price limit in paise. ₹5,000 is 500000."),
        category: z.string().max(80).optional(),
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
