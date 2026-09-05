import { buyerMandates, type BuyerMandate, db } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { recordAudit, recordFailure } from "./audit";
import { PaymentError } from "./errors";

/**
 * What a mandate permits, checked before anything is charged.
 *
 * Every bound in this system is enforced ahead of the gateway rather than
 * around it — `assertSpendCapFor` refuses before an order is written,
 * `checkMarginFloor` refuses before a discount is applied — and for the same
 * reason: a check that runs after the call has to unwind money, and unwinding
 * money is where systems like this actually break. Nothing here touches
 * Razorpay. A refusal costs a database read.
 *
 * It lives in `@workspace/payments` rather than in the agent layer's
 * `guardrails.ts` for the reason Phase 1 discovered the hard way: the order
 * path cannot import `@workspace/ai`, so a bound written there binds the one
 * caller that remembered to run it. Charging goes through here, so the rule
 * goes here, and the agent layer re-exports it.
 */

/**
 * Why a mandate could not pay, when it could not.
 *
 * Each is recoverable in the same turn by falling back to a payment link, and
 * each says something different to the buyer — "you are out of headroom", "it
 * lapsed on Tuesday" and "you took this back" are three different pieces of
 * news, and collapsing them into one refusal would be the kind of unhelpful
 * accuracy this project tries not to ship.
 */
export type MandateRefusal =
  | "MANDATE_EXHAUSTED"
  | "MANDATE_EXPIRED"
  | "MANDATE_OVER_PER_ORDER_CAP"
  | "MANDATE_REVOKED"
  | "MANDATE_WRONG_STORE";

export interface MandateCheck {
  /** What is left after this charge, when it is allowed. */
  remainingPaise: number;
  reason: MandateRefusal | null;
  /** The sentence the buyer reads, whichever way it went. */
  message: string;
  ok: boolean;
}

/** The fields the rule actually needs, so it can be tested without a row. */
export interface MandateBounds {
  expiresAt: Date;
  maxPerOrderPaise: number;
  maxTotalPaise: number;
  merchantId: string;
  revokedAt: Date | null;
  spentPaise: number;
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/**
 * The decision, with no database and no clock of its own.
 *
 * `now` is a parameter rather than a call to `Date.now()` because an expiry
 * rule tested against the real clock is a test that passes until the day it
 * does not. The order of the checks is deliberate: scope, then withdrawal,
 * then lapse, then the per-order bound, then the running total — from the
 * conditions that mean "this mandate was never yours to use" to the ones that
 * mean "it was, and it is spent".
 */
export function checkMandate(
  mandate: MandateBounds,
  params: { merchantId: string; now: Date; totalPaise: number }
): MandateCheck {
  const remaining = Math.max(0, mandate.maxTotalPaise - mandate.spentPaise);
  const refuse = (reason: MandateRefusal, message: string): MandateCheck => ({
    message,
    ok: false,
    reason,
    remainingPaise: remaining,
  });

  if (mandate.merchantId !== params.merchantId) {
    return refuse(
      "MANDATE_WRONG_STORE",
      "This authorisation was given for a different store."
    );
  }

  if (mandate.revokedAt) {
    return refuse(
      "MANDATE_REVOKED",
      `This authorisation was withdrawn on ${mandate.revokedAt.toDateString()}. Nothing was charged.`
    );
  }

  if (mandate.expiresAt.getTime() <= params.now.getTime()) {
    return refuse(
      "MANDATE_EXPIRED",
      `This authorisation lapsed on ${mandate.expiresAt.toDateString()}. Nothing was charged.`
    );
  }

  if (params.totalPaise > mandate.maxPerOrderPaise) {
    return refuse(
      "MANDATE_OVER_PER_ORDER_CAP",
      `This order of ${rupees(params.totalPaise)} is over the ${rupees(mandate.maxPerOrderPaise)} you set for a single purchase. Nothing was charged.`
    );
  }

  if (params.totalPaise > remaining) {
    return refuse(
      "MANDATE_EXHAUSTED",
      `This order of ${rupees(params.totalPaise)} is ${rupees(params.totalPaise - remaining)} more than the ${rupees(remaining)} left on this authorisation. Nothing was charged.`
    );
  }

  return {
    message: `Charged against your standing authorisation; ${rupees(remaining - params.totalPaise)} of ${rupees(mandate.maxTotalPaise)} remains.`,
    ok: true,
    reason: null,
    remainingPaise: remaining - params.totalPaise,
  };
}

/**
 * This buyer's live authorisation for this store, or nothing.
 *
 * Absence is not a failure — it is the ordinary case, and it means the
 * purchase falls back to the payment link and a human. Only a mandate that
 * exists and does not cover the order is an error worth logging, which is why
 * this returns `null` rather than throwing.
 */
export async function findMandate(params: {
  buyerIdentifier: string;
  merchantId: string;
}): Promise<BuyerMandate | null> {
  const row = await db.query.buyerMandates.findFirst({
    orderBy: desc(buyerMandates.createdAt),
    where: and(
      eq(buyerMandates.buyerIdentifier, params.buyerIdentifier),
      eq(buyerMandates.merchantId, params.merchantId),
      isNull(buyerMandates.revokedAt)
    ),
  });

  return row ?? null;
}

/**
 * Enforces the mandate, and records the refusal as something the agent can say.
 *
 * A breach is not a crash. It goes to `failures` and `audit_logs` under its own
 * code and comes back as a `PaymentError` the route handler maps to a clean
 * status, so the buyer hears what happened and what is left rather than a
 * stack trace — the same treatment `BUDGET_CHECK_FAILED` gets.
 */
export async function assertMandateCovers(
  mandate: BuyerMandate,
  params: { merchantId: string; now?: Date; orderId?: string; totalPaise: number }
): Promise<MandateCheck> {
  const check = checkMandate(mandate, {
    merchantId: params.merchantId,
    now: params.now ?? new Date(),
    totalPaise: params.totalPaise,
  });

  if (check.ok) {
    return check;
  }

  await recordAudit({
    action: "MANDATE_CHARGE_REFUSED",
    actorId: mandate.buyerIdentifier,
    actorType: "system",
    explanation: check.message,
    merchantId: params.merchantId,
    metadata: {
      attemptedPaise: params.totalPaise,
      mandateId: mandate.id,
      reason: check.reason,
      remainingPaise: check.remainingPaise,
    },
    orderId: params.orderId ?? null,
  });

  await recordFailure({
    errorMessage: check.message,
    errorType: check.reason ?? "MANDATE_REFUSED",
    orderId: params.orderId ?? null,
    recoveryAction: "Fell back to a payment link for a human to complete",
  });

  throw new PaymentError("MANDATE_REFUSED", check.message, {
    mandateId: mandate.id,
    reason: check.reason,
    remainingPaise: check.remainingPaise,
  });
}
