import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { issueAgentKey, listAgentKeys } from "@/lib/api/agent-keys";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * The credentials a merchant hands to a buying agent.
 *
 * `.well-known/agent-commerce.json` has told counterparties since day one to
 * "issue a key from the merchant dashboard", and there was nothing there to
 * issue one from. This is that.
 *
 * Only the owner of the store may touch these — `assertMerchantOwner` refuses
 * API-key callers outright, which is the rule that matters here more than
 * anywhere else in the app: a buying agent that could mint itself a key with a
 * cap of its own choosing would make every other bound decorative.
 */

const issueSchema = z.object({
  label: z.string().min(2).max(80),
  merchantId: z.uuid(),
  /** Omitted means "use the platform default". */
  spendCapPaise: z.number().int().positive().max(1_000_000_000).optional(),
});

/** GET /api/merchants/agent-keys?merchantId=... */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const merchantId = new URL(request.url).searchParams.get("merchantId");

    if (!merchantId) {
      return ok([]);
    }

    await assertMerchantOwner(actor, merchantId);

    return ok(await listAgentKeys(merchantId));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/merchants/agent-keys
 *
 * The response carries the secret, and it is the only time it ever will. It is
 * not stored anywhere this app can read it back: a screen that can re-display
 * a key leaks every key it has ever issued to whoever reaches that screen.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor?.userId) {
      return unauthorized();
    }

    const body = issueSchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    const issued = await issueAgentKey({
      label: body.label,
      merchantId: body.merchantId,
      spendCapPaise: body.spendCapPaise ?? null,
      userId: actor.userId,
    });

    return ok(issued, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
