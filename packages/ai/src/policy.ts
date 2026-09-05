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

/**
 * Clamps to the platform ceiling, and never below zero.
 *
 * Exported because it is the security-relevant line in this file — it is the
 * reason a merchant, a compromised session or the assistant cannot raise a
 * bound — and a rule like that should be testable without a database.
 */
export function stricter(
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

/**
 * What a merchant may change, and what they are changing it from.
 *
 * Every field is optional because a partial update is the normal case — a
 * merchant tightening their discount cap should not have to restate the other
 * five. `null` is a real value here and means "go back to the platform
 * default", which is different from omitting the key entirely.
 */
export interface PolicyUpdate {
  agentOrdersRequireApproval?: boolean;
  autoApproveCeilingPaise?: number | null;
  marginFloorPercent?: number | null;
  maxDiscountPercent?: number | null;
  maxPriceMovePercent?: number | null;
  spendCapPaise?: number | null;
}

export interface PolicyChange {
  after: EffectivePolicy;
  before: EffectivePolicy;
  /** Fields whose effective value actually moved. Empty means a no-op write. */
  changed: PolicyField[];
}

/** A bound that can move. `merchantConfigured` is derived, so it is excluded. */
export type PolicyField = Exclude<keyof EffectivePolicy, "merchantConfigured">;

/**
 * The most this deployment will allow, whatever a merchant asks for.
 *
 * Shown beside each field on the account screen. A number a merchant cannot
 * exceed should be visible while they choose, not discovered after saving —
 * otherwise the clamp reads as the form losing their input.
 */
export function platformCeilings(): Omit<
  EffectivePolicy,
  "agentOrdersRequireApproval" | "merchantConfigured"
> {
  return {
    autoApproveCeilingPaise: autoApproveCeilingPaise(),
    marginFloorPercent: LIMITS.minMarginPercent,
    maxDiscountPercent: LIMITS.maxDiscountPercent,
    maxPriceMovePercent: LIMITS.maxPriceMovePercent,
    spendCapPaise: spendCapPaise(),
  };
}

/**
 * Writes a store's own bounds.
 *
 * The clamping is deliberately *not* done here — it is done by
 * `getEffectivePolicy` on the way back out, which is the only way to guarantee
 * that a row written before a platform ceiling dropped cannot outlive it. What
 * this function stores is the merchant's stated intent; what the system obeys
 * is always the stricter of that and `LIMITS`.
 *
 * That distinction matters for the UI too. A merchant who types 50 into a field
 * capped at 30 meant "as high as you'll let me", and showing them 30 back is a
 * more honest answer than either refusing the write or pretending 50 took.
 *
 * The before/after pair exists so the caller can audit the change. Loosening
 * `agentOrdersRequireApproval` is the single most consequential toggle in this
 * system and the trail has to name it.
 */
export async function updateMerchantPolicy(
  merchantId: string,
  update: PolicyUpdate
): Promise<PolicyChange> {
  const before = await getEffectivePolicy(merchantId);

  await db
    .insert(merchantPolicy)
    .values({ merchantId, ...update })
    .onConflictDoUpdate({
      set: { ...update, updatedAt: new Date() },
      target: merchantPolicy.merchantId,
    });

  const after = await getEffectivePolicy(merchantId);

  const changed = (Object.keys(after) as (keyof EffectivePolicy)[]).filter(
    (key): key is PolicyField =>
      key !== "merchantConfigured" && before[key] !== after[key]
  );

  return { after, before, changed };
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
