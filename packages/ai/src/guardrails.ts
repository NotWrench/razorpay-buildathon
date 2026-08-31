import { db, orders } from "@workspace/db";
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
