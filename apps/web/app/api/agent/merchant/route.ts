import {
  buildMerchantContext,
  hasModelCredentials,
  type MerchantMessage,
  streamMerchantTurn,
} from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { fail, handleRouteError, unauthorized } from "@/lib/api/respond";

export const maxDuration = 30;

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  merchantId: z.uuid(),
  messages: z.array(z.any()),
});

/**
 * POST /api/agent/merchant
 *
 * One turn of the merchant assistant. Ownership is checked before the agent is
 * built, so its tools can never be pointed at a store the caller does not own.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    if (!hasModelCredentials()) {
      return fail(
        "MODEL_NOT_CONFIGURED",
        "Set OPENAI_API_KEY or AI_GATEWAY_API_KEY to enable the assistant",
        503
      );
    }

    const body = bodySchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    const ctx = await buildMerchantContext({
      actor: toAgentActor(actor),
      conversationId: body.conversationId,
      merchantId: body.merchantId,
    });

    return await streamMerchantTurn({
      ctx,
      messages: body.messages as MerchantMessage[],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
