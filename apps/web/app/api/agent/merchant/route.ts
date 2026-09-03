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

/**
 * How long the platform will let one turn run.
 *
 * A shopping turn is a dozen model round trips and as many tool calls; measured
 * against the free NIM tier one took 59s, and the same request later took 101s.
 * The old 30 seconds killed real turns partway through with no message to show
 * for it. `AGENT_TURN_BUDGET_MS` must stay comfortably below this — the agent
 * gives up first, on purpose, so the buyer is told what happened instead of
 * watching the connection die. The margin covers the abort's own overshoot; see
 * `packages/ai/src/agents/turn.ts`.
 *
 * Note that Vercel's Hobby plan caps this at 60s, which no measured turn on the
 * free NIM tier fits inside. Deploying there needs a faster model provider, not
 * a smaller number here.
 */
export const maxDuration = 180;

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
      abortSignal: request.signal,
      ctx,
      messages: body.messages as MerchantMessage[],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
