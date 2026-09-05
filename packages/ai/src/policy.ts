import { db, merchantPolicy } from "@workspace/db";
import { eq } from "drizzle-orm";
import { autoApproveCeilingPaise, spendCapPaise } from "./context";
import { LIMITS } from "./guardrails";
import { formatPaise } from "./money";

/**
 * The bounds that actually apply to one store.
 *
 * Until now every limit here was a constant or an environment variable, which
 * made "bounded" something a developer promised on the merchant's behalf. The
 * money is theirs; the numbers should be too.
 *
 * Two rules make this safe to expose.
 *
 * **The platform ceiling always wins.** A merchant's row can only be
 * *stricter* than `LIMITS`, so nobody — not the merchant, not a compromised
 * session, not the assistant — can raise the discount cap to 80%. Loosening is
 * clamped silently rather than refused, because a merchant who types 50 into a
 * field meant "as high as you'll let me", and the effective value is shown
 * back to them either way.
 *
 * **Absent means default, not zero.** Every column is nullable for the same
 * reason the specs are: not configured and configured to nothing are different
 * facts, and only one of them is a decision.
 */

export interface EffectivePolicy {
  agentOrdersRequireApproval: boolean;
  autoApproveCeilingPaise: number;
  marginFloorPercent: number;
  maxDiscountPercent: number;
  maxPriceMovePercent: number;
  /** True when this store has set anything of its own. */
  merchantConfigured: boolean;
  spendCapPaise: number;
}

/** Clamps to the platform ceiling, and never below zero. */
function stricter(
  chosen: number | null | undefined,
  ceiling: number
): number {
  if (chosen === null || chosen === undefined) {
    return ceiling;
  }

  return Math.max(0, Math.min(chosen, ceiling));
}

export async function getEffectivePolicy(
  merchantId: string
): Promise<EffectivePolicy> {
  const row = await db.query.merchantPolicy.findFirst({
    where: eq(merchantPolicy.merchantId, merchantId),
  });

  return {
    /*
     * The only bound a merchant may loosen, and deliberately so: switching it
     * off is the difference between this system and one that lets strangers'
     * software spend their money unattended. It is theirs to decide, and it is
     * recorded when they do.
     */
    agentOrdersRequireApproval: row?.agentOrdersRequireApproval ?? true,
    autoApproveCeilingPaise: stricter(
      row?.autoApproveCeilingPaise,
      autoApproveCeilingPaise()
    ),
    marginFloorPercent: Math.max(
      LIMITS.minMarginPercent,
      row?.marginFloorPercent ?? LIMITS.minMarginPercent
    ),
    maxDiscountPercent: stricter(
      row?.maxDiscountPercent,
      LIMITS.maxDiscountPercent
    ),
    maxPriceMovePercent: stricter(
      row?.maxPriceMovePercent,
      LIMITS.maxPriceMovePercent
    ),
    merchantConfigured: row !== undefined,
    spendCapPaise: stricter(row?.spendCapPaise, spendCapPaise()),
  };
}

/** The policy in sentences, for the agent to quote and the manifest to publish. */
export function describePolicy(policy: EffectivePolicy): string[] {
  return [
    `Discounts are capped at ${policy.maxDiscountPercent}%.`,
    `A single price change may not move a price by more than ${policy.maxPriceMovePercent}%.`,
    policy.marginFloorPercent > 0
      ? `Nothing may be sold at under a ${policy.marginFloorPercent}% margin.`
      : "Nothing may be sold below cost.",
    `One buyer may commit at most ${formatPaise(policy.spendCapPaise)} in a conversation.`,
    policy.agentOrdersRequireApproval
      ? "Every order placed by a buying agent waits for a human."
      : `Agent orders under ${formatPaise(policy.autoApproveCeilingPaise)} do not wait for a human.`,
  ];
}
