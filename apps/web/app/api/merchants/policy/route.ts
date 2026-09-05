import {
  AuditAction,
  describePolicy,
  type EffectivePolicy,
  getEffectivePolicy,
  recordAudit,
  updateMerchantPolicy,
} from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * A store's own bounds.
 *
 * `merchant_policy` has been read by `getEffectivePolicy` and published in the
 * discovery manifest since it existed, but nothing ever wrote it — so every
 * store ran on platform defaults and the per-store block in the manifest was
 * decoration. This is the writer.
 *
 * The safety is not in this handler. `updateMerchantPolicy` stores the
 * merchant's stated intent and `getEffectivePolicy` clamps on the way out, so
 * a value that would loosen a platform ceiling is stored and then ignored
 * forever after. That is deliberate: clamping on write would silently rewrite
 * what the merchant typed, and a row written before a ceiling dropped would
 * outlive it.
 *
 * What the response returns is always the *effective* policy, never the
 * submitted one. A merchant who asks for 50% on a field capped at 30 gets 30
 * back, which is a more honest answer than either refusing the write or
 * pretending 50 took.
 */

/**
 * `null` is meaningful and is not the same as omitting the key.
 *
 * Omitted means "leave this alone". Null means "go back to the platform
 * default" — the column is nullable precisely so that not configured and
 * configured to nothing stay different facts.
 */
const percent = z.number().int().min(0).max(100).nullable();
const paise = z.number().int().min(0).max(1_000_000_000).nullable();

const bodySchema = z
  .object({
    agentOrdersRequireApproval: z.boolean().optional(),
    autoApproveCeilingPaise: paise.optional(),
    marginFloorPercent: percent.optional(),
    maxDiscountPercent: percent.optional(),
    maxPriceMovePercent: percent.optional(),
    merchantId: z.uuid(),
    spendCapPaise: paise.optional(),
  })
  .strict();

/** The effective policy plus the sentences the agent and manifest quote. */
function body(policy: EffectivePolicy) {
  return { policy, summary: describePolicy(policy) };
}

/** GET /api/merchants/policy?merchantId=... — the bounds in force right now. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const merchantId = new URL(request.url).searchParams.get("merchantId");

    if (!merchantId) {
      return handleRouteError(
        new z.ZodError([
          {
            code: "custom",
            message: "merchantId is required",
            path: ["merchantId"],
          },
        ])
      );
    }

    await assertMerchantOwner(actor, merchantId);

    return ok(body(await getEffectivePolicy(merchantId)));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/merchants/policy
 *
 * Partial by design: a merchant tightening one number should not have to
 * restate the other five.
 */
export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { merchantId, ...update } = bodySchema.parse(await request.json());

    await assertMerchantOwner(actor, merchantId);

    const { after, before, changed } = await updateMerchantPolicy(
      merchantId,
      update
    );

    /*
     * A no-op write is not audited. A merchant who opens the form, changes
     * nothing and saves has done nothing, and a trail that says otherwise is
     * noise in the one place noise is expensive.
     */
    if (changed.length > 0) {
      await recordAudit({
        action: AuditAction.POLICY_CHANGED,
        actorId: actor.userId ?? actor.identifier,
        actorType: "merchant",
        explanation: changed
          .map((field) => `${field}: ${before[field]} → ${after[field]}`)
          .join("; "),
        merchantId,
        metadata: { after, before, changed },
      });
    }

    return ok({ ...body(after), changed });
  } catch (error) {
    return handleRouteError(error);
  }
}
