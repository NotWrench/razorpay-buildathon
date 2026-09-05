import { db, merchantPolicy } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BuyerType } from "./orders";

/**
 * Whether an agent's order has to wait for the merchant.
 *
 * This file exists because the answer was published and never asked.
 * `merchant_policy.agent_orders_require_approval` has been stored, clamped,
 * described in sentences on `/manager/account` and served in
 * `/.well-known/agent-commerce.json` since the policy table landed — while
 * `createCheckoutOrder` decided the same question from `buyerType` alone. A
 * merchant could switch the toggle off, read the manifest saying orders now
 * flow, and watch every one of them queue anyway.
 *
 * A published bound nobody enforces is worse than no bound, because a
 * counterparty reads it and plans against it. The same argument moved the
 * spend cap into `assertSpendCapFor`; this is that argument applied to the
 * other direction, where the gap made us *stricter* than advertised rather
 * than looser. Stricter is the safe way to be wrong and still wrong.
 *
 * It lives in `@workspace/payments` rather than beside `getEffectivePolicy` in
 * `@workspace/ai` because the dependency runs `ai → payments → commerce → db`.
 * The order path cannot import the agent layer, and this is a property of an
 * order rather than of an agent turn — a POST straight to
 * `/api/payments/orders` gets the same answer as a tool call, which is the
 * only version that cannot be forgotten.
 */

/**
 * The most a merchant on this deployment may let flow unattended.
 *
 * Ships at 0, so out of the box no auto-approval is reachable at any total no
 * matter what a merchant sets — the bound is a decision an operator makes
 * once, visibly, in the environment, and only then can a merchant make theirs.
 * Raising it does not by itself approve anything: a merchant still has to turn
 * `agentOrdersRequireApproval` off, and that flag defaults to true.
 *
 * Two independent conditions, deliberately. A merchant who says "small orders
 * may flow" has not said "any order may flow", and reading either one alone
 * would turn a bounded intention into an unbounded one.
 */
const DEFAULT_PLATFORM_AUTO_APPROVE_CEILING_PAISE = 0;

export function platformAutoApproveCeilingPaise(): number {
  const raw = process.env.AGENT_AUTO_APPROVE_CEILING_PAISE;

  if (!raw) {
    return DEFAULT_PLATFORM_AUTO_APPROVE_CEILING_PAISE;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_PLATFORM_AUTO_APPROVE_CEILING_PAISE;
}

/**
 * The stricter of two ceilings, never below zero.
 *
 * `undefined` and `null` mean "not configured", which falls back to the
 * ceiling rather than to zero — not set and set to nothing are different
 * statements, and only the second is a choice. Mirrors `stricter` in
 * `@workspace/ai`'s policy module, which clamps the merchant's other bounds
 * the same way and cannot be imported from here without inverting the
 * dependency.
 */
function stricterPaise(
  chosen: number | null | undefined,
  ceiling: number
): number {
  if (chosen === null || chosen === undefined) {
    return ceiling;
  }

  return Math.max(0, Math.min(chosen, ceiling));
}

export type ApprovalStatus = "approved" | "pending_approval";

export interface ApprovalDecision {
  /** The ceiling that actually applied, after every clamp. */
  ceilingPaise: number;
  /** Why it came out this way, for the audit entry and the agent to quote. */
  explanation: string;
  status: ApprovalStatus;
}

export interface ApprovalInputs {
  buyerType: BuyerType;
  ceilingPaise: number;
  requiresApproval: boolean;
  totalAmount: number;
}

/**
 * The decision itself, with no database in it.
 *
 * Pure so the rule can be tested exhaustively without a merchant row: the
 * interesting cases here are boundary cases, and a bound that is only ever
 * exercised through a seeded database is a bound nobody checks at the edges.
 */
export function decideApproval(input: ApprovalInputs): ApprovalDecision {
  const { buyerType, ceilingPaise, requiresApproval, totalAmount } = input;

  if (buyerType === "human") {
    return {
      ceilingPaise,
      explanation: "Human checkout; no merchant approval needed",
      status: "approved",
    };
  }

  if (requiresApproval) {
    return {
      ceilingPaise,
      explanation: "This store reviews every order placed by a buying agent",
      status: "pending_approval",
    };
  }

  if (totalAmount > ceilingPaise) {
    return {
      ceilingPaise,
      explanation: `Agent order of ${totalAmount} paise is over this store's unattended ceiling of ${ceilingPaise} paise`,
      status: "pending_approval",
    };
  }

  return {
    ceilingPaise,
    explanation: `Agent order of ${totalAmount} paise cleared under this store's unattended ceiling of ${ceilingPaise} paise`,
    status: "approved",
  };
}

/**
 * Reads the store's bounds and applies them to one order.
 *
 * `keyCeilingPaise` is the cap the merchant attached to the API key that
 * placed the order, and it can only ever tighten: a merchant trusting one
 * counterparty with a higher number must not be able to raise the shop-wide
 * ceiling by doing so, which is the same rule `stricter` enforces between a
 * merchant and the platform. Three layers, each only ever narrowing.
 */
export async function resolveOrderApproval(params: {
  buyerType: BuyerType;
  keyCeilingPaise?: number;
  merchantId: string;
  totalAmount: number;
}): Promise<ApprovalDecision> {
  const row = await db.query.merchantPolicy.findFirst({
    where: eq(merchantPolicy.merchantId, params.merchantId),
  });

  const merchantCeiling = stricterPaise(
    row?.autoApproveCeilingPaise,
    platformAutoApproveCeilingPaise()
  );

  return decideApproval({
    buyerType: params.buyerType,
    ceilingPaise: stricterPaise(params.keyCeilingPaise, merchantCeiling),
    /*
     * Absent means true. A store with no policy row has not opted out of
     * anything, and the one bound a merchant is allowed to loosen is the one
     * that should never loosen by default.
     */
    requiresApproval: row?.agentOrdersRequireApproval ?? true,
    totalAmount: params.totalAmount,
  });
}
