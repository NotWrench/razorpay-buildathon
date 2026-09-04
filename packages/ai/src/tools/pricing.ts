import {
  db,
  productPriceHistory,
  products,
} from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { AuditAction, recordAudit, recordFailure } from "../audit";
import type { AgentContext } from "../context";
import { LIMITS } from "../guardrails";
import { describeMargin } from "../margin";
import { formatPaise } from "../money";

/**
 * The most direct revenue lever there is, and the most dangerous.
 *
 * Every other write in this room affects one order or one draft.
 * `updateProductPrice` affects every order anybody places afterwards, it is
 * invisible after the fact — the row simply holds a different number — and it
 * is exactly the tool a model reaches for when asked to "improve margins".
 *
 * Four things hold it down, and none of them is the prompt:
 *
 *   - a per-move clamp, so one call cannot move a price by more than 20%;
 *   - a daily count, because a clamp on the step size does nothing against
 *     five steps in a row;
 *   - the margin floor, so a cut cannot cross cost;
 *   - the approval gate, so a human sees the old price, the new price and
 *     the margin at each before anything moves.
 *
 * And `product_price_history` makes it legible afterwards, which is the part
 * that lets it exist at all: "why is this ₹4,000 more than last month" has an
 * answer with a name and a reason against it.
 */

const DAY_MS = 86_400_000;
const PERCENT = 100;

export function pricingTools(ctx: AgentContext) {
  return {
    getPriceHistory: tool({
      description:
        "Every price this product has carried, who changed it and why. Use " +
        "it before proposing a move — a price that has already been raised " +
        "twice this month is a different situation from one that has not " +
        "moved in a year.",
      execute: async ({ productId }) => {
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, productId),
            eq(products.merchantId, ctx.merchantId)
          ),
        });

        if (!product) {
          return { found: false, error: "That product is not in this store." };
        }

        const rows = await db
          .select()
          .from(productPriceHistory)
          .where(eq(productPriceHistory.productId, productId))
          .orderBy(desc(productPriceHistory.createdAt))
          .limit(20);

        const margin = describeMargin(product);

        return {
          changes: rows.map((row) => ({
            at: row.createdAt,
            by: row.actorType,
            from: formatPaise(row.oldPrice),
            reason: row.reason,
            to: formatPaise(row.newPrice),
          })),
          currentPrice: formatPaise(product.price),
          found: true,
          margin:
            margin.marginPaise === null
              ? "no cost recorded, so the margin is unknown"
              : `${formatPaise(margin.marginPaise)} (${margin.marginPercent}%)`,
          name: product.name,
        };
      },
      inputSchema: z.object({ productId: z.uuid() }),
    }),

    updateProductPrice: tool({
      description:
        "Change what a product sells for. This applies to every order from " +
        "now on, not just one, so it is bounded and gated: a single move is " +
        "capped at " +
        `${LIMITS.maxPriceMovePercent}% of the current price, at most ` +
        `${LIMITS.maxPriceMovesPerDay} moves a day are allowed per product, ` +
        "and a price below cost is refused outright. Check getPriceHistory " +
        "first and say what the margin becomes.",
      execute: async ({ newPricePaise, productId, reason }) => {
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, productId),
            eq(products.merchantId, ctx.merchantId)
          ),
        });

        if (!product) {
          return { error: "That product is not in this store.", updated: false };
        }

        if (newPricePaise === product.price) {
          return {
            error: `${product.name} is already ${formatPaise(product.price)}.`,
            updated: false,
          };
        }

        const movePercent = Math.abs(
          ((newPricePaise - product.price) / product.price) * PERCENT
        );

        if (movePercent > LIMITS.maxPriceMovePercent) {
          const message =
            `That is a ${movePercent.toFixed(1)}% move on ${product.name}, over the ` +
            `${LIMITS.maxPriceMovePercent}% cap for a single change. Nothing was changed. ` +
            "Propose a smaller move, or make it in steps the merchant approves one at a time.";

          await recordFailure({
            errorMessage: message,
            errorType: "PRICE_MOVE_TOO_LARGE",
          });

          return { error: message, updated: false };
        }

        /*
         * The bound that actually matters. Clamping each step to 20% is no
         * protection at all against a model that takes five steps, and an
         * assistant walking a price down over an afternoon is precisely the
         * drift this system is built to prevent.
         */
        const today = await db
          .select({ id: productPriceHistory.id })
          .from(productPriceHistory)
          .where(
            and(
              eq(productPriceHistory.productId, productId),
              gte(
                productPriceHistory.createdAt,
                new Date(Date.now() - DAY_MS)
              )
            )
          );

        if (today.length >= LIMITS.maxPriceMovesPerDay) {
          const message =
            `${product.name} has already been repriced ${today.length} time(s) in the last 24 hours, ` +
            `which is the limit. Nothing was changed. If it genuinely needs another move, it can wait a day — ` +
            "and if it needs several in one day, that is a conversation to have rather than a price to nudge.";

          await recordFailure({
            errorMessage: message,
            errorType: "PRICE_MOVE_RATE_LIMITED",
          });

          return { error: message, updated: false };
        }

        // Below cost is refused whichever direction it came from.
        if (
          product.costPrice !== null &&
          newPricePaise <
            Math.ceil(
              product.costPrice / (1 - LIMITS.minMarginPercent / PERCENT)
            )
        ) {
          const message =
            `${formatPaise(newPricePaise)} is below what ${product.name} costs ` +
            `(${formatPaise(product.costPrice)}). Nothing was changed.`;

          await recordFailure({
            errorMessage: message,
            errorType: "MARGIN_FLOOR_BREACHED",
          });

          return { error: message, updated: false };
        }

        const actorId = ctx.actor.userId ?? ctx.actor.identifier;

        await db.transaction(async (tx) => {
          await tx
            .update(products)
            .set({ price: newPricePaise })
            .where(eq(products.id, productId));

          await tx.insert(productPriceHistory).values({
            actorType: "ai_assistant",
            changedBy: actorId,
            merchantId: ctx.merchantId,
            newPrice: newPricePaise,
            oldPrice: product.price,
            productId,
            reason,
          });
        });

        await recordAudit({
          action: AuditAction.PRICE_CHANGED,
          actorId,
          actorType: "ai_assistant",
          explanation: `Moved ${product.name} from ${formatPaise(product.price)} to ${formatPaise(newPricePaise)}: ${reason}`,
          merchantId: ctx.merchantId,
          metadata: {
            newPricePaise,
            oldPricePaise: product.price,
            productId,
          },
        });

        const after = describeMargin({ ...product, price: newPricePaise });

        return {
          from: formatPaise(product.price),
          marginAfter:
            after.marginPaise === null
              ? "unknown — no cost is recorded for this product"
              : `${formatPaise(after.marginPaise)} (${after.marginPercent}%)`,
          summary: `${product.name} is now ${formatPaise(newPricePaise)}, was ${formatPaise(product.price)}.`,
          to: formatPaise(newPricePaise),
          updated: true,
        };
      },
      inputSchema: z.object({
        newPricePaise: z.number().int().positive().max(100_000_000),
        productId: z.uuid(),
        reason: z
          .string()
          .min(20)
          .max(1000)
          .describe(
            "Why, in the merchant's terms. This is stored against the price forever and is what answers 'why is this more than it was'."
          ),
      }),
    }),
  } satisfies ToolSet;
}
