import { db, productSpecs, products } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import { embeddableText, embedQuery } from "../embeddings";
import { formatPaise } from "../money";
import { embeddingModelId } from "../provider";
import { describeReadiness, getCatalogReadiness } from "../readiness";
import { optional } from "./schema";

/**
 * The merchant's view of their own agent-readability, and the fix for it.
 *
 * Reading is free and ungated. `enrichProduct` writes to the catalogue — it
 * changes what every buying agent is told about a product from that moment on
 * — so it stops for the merchant like every other write in this room.
 */
export function readinessTools(ctx: AgentContext) {
  return {
    enrichProduct: tool({
      description:
        "Fill in what an AI buyer is missing about a product: its description " +
        "and its typed specifications. Pass only the fields you are adding. " +
        "Never invent a specification — take it from the merchant, or from " +
        "the product's own description if it is stated there. A wrong spec is " +
        "far worse than a missing one: a missing one returns " +
        "insufficient_data and the buyer checks, a wrong one produces a " +
        "confident answer that sells somebody a part that does not fit.",
      execute: async ({ description, productId, specs }) => {
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, productId),
            eq(products.merchantId, ctx.merchantId)
          ),
        });

        if (!product) {
          return { enriched: false, error: "That product is not in this store." };
        }

        const changed: string[] = [];

        if (description) {
          await db
            .update(products)
            .set({ description })
            .where(eq(products.id, productId));

          changed.push("description");
        }

        const patch = Object.fromEntries(
          Object.entries(specs ?? {}).filter(([, value]) => value !== undefined)
        );

        if (Object.keys(patch).length > 0) {
          if (!product.category) {
            return {
              enriched: false,
              error:
                "That product has no category, so its specs cannot be typed. Give it a category first.",
            };
          }

          await db
            .insert(productSpecs)
            .values({
              categorySlug: product.category,
              merchantId: ctx.merchantId,
              productId,
              ...patch,
            })
            .onConflictDoUpdate({
              set: patch,
              target: productSpecs.productId,
            });

          changed.push(...Object.keys(patch));
        }

        if (changed.length === 0) {
          return { enriched: false, error: "Nothing to change." };
        }

        /*
         * Re-embed when the words changed. A product whose description was the
         * reason search could not find it is not fixed until the vector is
         * rewritten — the old one still describes the old text.
         *
         * The embedding is best-effort: the free tier runs out, and an
         * enrichment that succeeded should not be reported as a failure
         * because a quota did. The gap simply persists and readiness still
         * reports it.
         */
        let reEmbedded = false;

        if (description) {
          try {
            const vector = await embedQuery(
              embeddableText({ ...product, description })
            );

            if (vector) {
              await db
                .update(products)
                .set({ embedding: vector, embeddingModel: embeddingModelId() })
                .where(eq(products.id, productId));

              reEmbedded = true;
            }
          } catch {
            reEmbedded = false;
          }
        }

        await recordAudit({
          action: AuditAction.PRODUCT_ENRICHED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "ai_assistant",
          explanation: `Filled in ${changed.join(", ")} for ${product.name}.`,
          merchantId: ctx.merchantId,
          metadata: { changed, productId },
        });

        return {
          changed,
          enriched: true,
          note:
            description && !reEmbedded
              ? "The description was saved but could not be re-embedded just now, so semantic search still holds the old text. Run the embedding backfill later."
              : undefined,
          summary: `Updated ${changed.join(", ")} on ${product.name}.`,
        };
      },
      inputSchema: z.object({
        description: optional(z.string().min(60).max(2000)).describe(
          "At least a sentence about what it is and who it suits. Under 60 characters grounds nothing."
        ),
        productId: z.uuid(),
        specs: optional(
          z.object({
            formFactor: optional(z.string().max(40)),
            heightMm: optional(z.number().int().min(1).max(1000)),
            lengthMm: optional(z.number().int().min(1).max(1000)),
            maxCoolerHeightMm: optional(z.number().int().min(1).max(1000)),
            maxGpuLengthMm: optional(z.number().int().min(1).max(1000)),
            memoryCapacityGb: optional(z.number().int().min(1).max(4096)),
            memorySlots: optional(z.number().int().min(1).max(16)),
            memoryType: optional(z.string().max(20)),
            psuWattage: optional(z.number().int().min(1).max(3000)),
            socket: optional(z.string().max(60)),
            storageInterface: optional(z.string().max(40)),
            tdpWatts: optional(z.number().int().min(1).max(1000)),
          })
        ),
      }),
    }),

    getCatalogReadiness: tool({
      description:
        "How much of the catalogue an AI buyer can actually find, compare " +
        "and trust — with the specific field missing from each product and " +
        "what its absence costs. Use this when the merchant asks why agents " +
        "are not buying, or what to fix. Lead with the money on the shelf " +
        "behind the products that are invisible, not with the percentage.",
      execute: async ({ limit }) => {
        const readiness = await getCatalogReadiness(ctx.merchantId);

        return {
          assumptions: readiness.assumptions,
          blockedCount: readiness.blocked.length,
          commonestGaps: readiness.gapCounts.slice(0, 6),
          headline: describeReadiness(readiness),
          productsScored: readiness.productsScored,
          // Worst money first, blocking gaps flagged as such — the merchant
          // should fix the ₹4 lakh card an agent cannot find before the ₹900
          // fan that only wants a photograph.
          products: readiness.needsWork.slice(0, limit).map((product) => ({
            blocksRecommendation: product.blocked,
            category: product.category,
            gaps: product.gaps.map(
              (gap) =>
                `${gap.detail} — ${gap.costs}${gap.blocking ? "" : " (does not block a sale)"}`
            ),
            name: product.name,
            productId: product.productId,
            score: product.score,
            stockValue: formatPaise(product.stockValuePaise),
          })),
          revenueAtRisk: formatPaise(readiness.revenueAtRiskPaise),
          score: readiness.score,
        };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(10),
      }),
    }),
  } satisfies ToolSet;
}
