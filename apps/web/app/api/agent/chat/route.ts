import {
  buildStorefrontContext,
  CHAT_MODES,
  CONTEXT_PAGES,
  hasModelCredentials,
  type StorefrontMessage,
  streamStorefrontTurn,
} from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
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
  /**
   * §7 page context. Every id here is client-supplied and re-read server-side
   * under the buyer's own scope; anything that does not resolve is dropped
   * rather than refused. See `packages/ai/src/page-context.ts`.
   */
  context: z
    .object({
      buildId: z.uuid().optional(),
      cartId: z.uuid().optional(),
      orderId: z.uuid().optional(),
      page: z.enum(CONTEXT_PAGES),
      productId: z.uuid().optional(),
      searchQuery: z.string().max(300).optional(),
    })
    .optional(),
  conversationId: z.uuid().optional(),
  messages: z.array(z.any()),
  /**
   * §6's task mode. Optional: without one the agent keeps every tool, which
   * is the behaviour every existing caller already relies on.
   */
  mode: z.enum(CHAT_MODES).optional(),
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
      // Closing the tab should stop the model, not leave it generating into a
      // socket nobody is reading.
      abortSignal: request.signal,
      context: body.context,
      ctx,
      messages: body.messages as StorefrontMessage[],
      mode: body.mode,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
