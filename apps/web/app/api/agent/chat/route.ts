import {
  buildStorefrontContext,
  hasModelCredentials,
  type StorefrontMessage,
  streamStorefrontTurn,
} from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
import { fail, handleRouteError, unauthorized } from "@/lib/api/respond";

export const maxDuration = 30;

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  messages: z.array(z.any()),
  slug: z.string().min(1).max(120),
});

/**
 * POST /api/agent/chat
 *
 * One turn of the storefront shopping agent.
 *
 * The merchant is resolved from the store slug and the buyer from the session
 * or API key — neither is ever taken from the message body, so the model cannot
 * shop on another store's catalog or as someone else.
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

    const ctx = await buildStorefrontContext({
      actor: toAgentActor(actor),
      conversationId: body.conversationId,
      slug: body.slug,
    });

    return await streamStorefrontTurn({
      ctx,
      messages: body.messages as StorefrontMessage[],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
