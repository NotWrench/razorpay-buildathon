import { db, orders, products } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { and, eq, inArray, sum } from "drizzle-orm";
import { AuditAction, recordAudit, recordFailure } from "./audit";
import type { AgentContext } from "./context";
import { formatPaise } from "./money";

/**
 * Bounds on what an agent may do with money.
 *
 * These are checked inside `execute`, before any write and before Razorpay is
 * ever touched. They are the second of three layers: the tool-approval gate
 * stops the loop for a human, these caps bound what can even be proposed, and
 * the database refuses to activate an unapproved agent order at all.
 */

export const LIMITS = {
  /** Campaign discounts are capped so the AI cannot give the store away. */
  maxDiscountPercent: 30,
  maxLineItems: 20,
  maxQuantityPerLine: 10,
  /**
   * The thinnest margin a discount may leave, as a percentage of the price.
   *
   * Zero means "never sell below cost". It is a separate bound from the
   * discount cap and it has to be, because the two catch different mistakes: a
   * 30% cap is generous on a case fan and ruinous on a graphics card the shop
   * buys at 90% of list. The percentage cap protects against a model being
   * silly; this protects against a model being reasonable about the wrong
   * product.
   */
  minMarginPercent: 0,
} as const;

/** Thrown as a `PaymentError` so route handlers map it to a clean HTTP status. */
function violation(message: string, details?: unknown): PaymentError {
  return new PaymentError("EMPTY_CART", message, details);
}

export interface CartInput {
  productId: string;
  quantity: number;
}

/** Structural limits on a proposed cart — checked before any DB read. */
export function assertCartShape(items: CartInput[]): void {
  if (items.length === 0) {
    throw violation("A cart needs at least one item");
  }

  if (items.length > LIMITS.maxLineItems) {
    throw violation(
      `A cart may hold at most ${LIMITS.maxLineItems} line items; this one has ${items.length}`
    );
  }

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > LIMITS.maxQuantityPerLine) {
      throw violation(
        `Quantity must be between 1 and ${LIMITS.maxQuantityPerLine} per line item`
      );
    }
  }
}

/** Total the agent has already committed in this conversation. */
export async function committedSpendPaise(ctx: AgentContext): Promise<number> {
  const [row] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, ctx.merchantId),
        eq(orders.buyerIdentifier, ctx.actor.identifier),
        inArray(orders.orderStatus, ["created", "paid"])
      )
    );

  return Number(row?.total ?? 0);
}

/**
 * Enforces the per-conversation spend cap.
 *
 * A breach is not a crash: it is logged to `failures` and `audit_logs` as a
 * `BUDGET_CHECK_FAILED`, then surfaced to the agent as an explainable error it
 * can relay to the buyer.
 */
export async function assertWithinSpendCap(
  ctx: AgentContext,
  amountPaise: number
): Promise<void> {
  const committed = await committedSpendPaise(ctx);
  const projected = committed + amountPaise;

  if (projected <= ctx.spendCapPaise) {
    return;
  }

  const message =
    "This purchase would take the total committed in this conversation to " +
    `${formatPaise(projected)}, over the ${formatPaise(ctx.spendCapPaise)} cap. ` +
    "Nothing was ordered and nothing was charged.";

  await recordAudit({
    action: AuditAction.BUDGET_CHECK_FAILED,
    actorId: ctx.actor.identifier,
    actorType: ctx.actor.type === "human" ? "human_buyer" : "external_ai_agent",
    explanation: message,
    merchantId: ctx.merchantId,
    metadata: {
      attemptedPaise: amountPaise,
      capPaise: ctx.spendCapPaise,
      committedPaise: committed,
    },
  });

  await recordFailure({
    errorMessage: message,
    errorType: "BUDGET_EXCEEDED",
  });

  throw violation(message, {
    capPaise: ctx.spendCapPaise,
    committedPaise: committed,
  });
}

export interface MarginBreach {
  costPaise: number;
  discountedPricePaise: number;
  name: string;
  productId: string;
}

/**
 * Refuses a discount that would sell a product below its floor.
 *
 * Checked against every product a campaign names, before the campaign is
 * written. A breach is not a crash: it is logged as a `MARGIN_FLOOR_BREACHED`
 * failure and surfaced to the agent as an explainable error it can relay — the
 * same shape as the spend cap, for the same reason. The agent should be able
 * to say "30% off the 4060 Ti would sell it under cost, so I capped it at 9%"
 * rather than silently producing a campaign that loses money on every unit.
 *
 * Products with no recorded cost are skipped rather than blocked. An unknown
 * margin is not a breach, and refusing every discount on an uncosted product
 * would make the missing data look like a policy. They come back in
 * `unpriced` so the caller can say which ones went unchecked.
 */
export async function checkMarginFloor(
  merchantId: string,
  productIds: string[],
  discountFor: (pricePaise: number) => number
): Promise<{ breaches: MarginBreach[]; unpriced: string[] }> {
  if (productIds.length === 0) {
    return { breaches: [], unpriced: [] };
  }

  const rows = await db
    .select({
      costPrice: products.costPrice,
      id: products.id,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        inArray(products.id, productIds)
      )
    );

  const breaches: MarginBreach[] = [];
  const unpriced: string[] = [];

  for (const row of rows) {
    if (row.costPrice === null) {
      unpriced.push(row.name);
      continue;
    }

    const discounted = row.price - discountFor(row.price);
    const floor = Math.ceil(
      row.costPrice / (1 - LIMITS.minMarginPercent / 100)
    );

    if (discounted < floor) {
      breaches.push({
        costPaise: row.costPrice,
        discountedPricePaise: discounted,
        name: row.name,
        productId: row.id,
      });
    }
  }

  return { breaches, unpriced };
}

/** Records a refused discount where the merchant can find it later. */
export async function recordMarginBreach(
  ctx: AgentContext,
  breaches: MarginBreach[]
): Promise<string> {
  const message =
    `That discount would sell ${breaches.length} product(s) below cost: ` +
    breaches
      .map(
        (breach) =>
          `${breach.name} at ${formatPaise(breach.discountedPricePaise)} against a cost of ${formatPaise(breach.costPaise)}`
      )
      .join("; ") +
    ". Nothing was drafted.";

  await recordAudit({
    action: AuditAction.MARGIN_FLOOR_BREACHED,
    actorId: ctx.actor.userId ?? ctx.actor.identifier,
    actorType: "ai_assistant",
    explanation: message,
    merchantId: ctx.merchantId,
    metadata: { breaches },
  });

  await recordFailure({
    errorMessage: message,
    errorType: "MARGIN_FLOOR_BREACHED",
  });

  return message;
}

/** Clamps an AI-proposed discount to something a merchant would sign off on. */
export function clampDiscountPercent(percent: number): number {
  return Math.max(0, Math.min(Math.round(percent), LIMITS.maxDiscountPercent));
}

/** Clamps a flat discount so it can never exceed the cart it applies to. */
export function clampFlatDiscount(
  discountPaise: number,
  subtotalPaise: number
): number {
  return Math.max(0, Math.min(Math.round(discountPaise), subtotalPaise));
}
