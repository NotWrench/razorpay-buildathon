import {
  buildMerchantContext,
  hasModelCredentials,
  runMerchantBriefing,
} from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { fail, handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * POST /api/agent/merchant/briefing
 *
 * One unattended run of the merchant agent. The output is a short briefing
 * plus, at most, one drafted campaign and one reorder request — all of it
 * inert until the merchant approves it.
 *
 * The safety here is not in this handler. Every money tool returns
 * `user-approval` from the same policy the interactive agent uses, and there is
 * no human in an unattended run to answer it, so those tools suspend and never
 * execute. See `agents/briefing.ts`.
 *
 * Authorisation is deliberately the ordinary one rather than a shared secret:
 * this runs as a specific merchant, against their store, and the audit trail
 * should name them. A cron caller signs in as the store owner like anybody
 * else.
 */

export const maxDuration = 300;

const bodySchema = z.object({ merchantId: z.uuid() });

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    if (!hasModelCredentials()) {
      return fail(
        "MODEL_NOT_CONFIGURED",
        "Set a model provider key to run the briefing",
        503
      );
    }

    const body = bodySchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    const ctx = await buildMerchantContext({
      actor: toAgentActor(actor),
      merchantId: body.merchantId,
    });

    return ok(await runMerchantBriefing(ctx));
  } catch (error) {
    return handleRouteError(error);
  }
}
