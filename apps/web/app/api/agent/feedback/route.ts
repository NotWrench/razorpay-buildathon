import { buildStorefrontContext, recordFeedback } from "@workspace/ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  conversationId: z.uuid(),
  note: z.string().max(2000).optional(),
  /** Validated against this conversation server-side, never trusted. */
  recommendationId: z.uuid().optional(),
  slug: z.string().min(1).max(120),
  thumbs: z.enum(["up", "down"]),
});

/**
 * POST /api/agent/feedback
 *
 * What the buyer thought of a recommendation (§24).
 *
 * The conversation is resolved through `buildStorefrontContext`, which only
 * returns a conversation belonging to this buyer — so a caller cannot rate
 * somebody else's chat, and a `recommendationId` from another conversation is
 * dropped rather than stored. Feedback is the one measure in the agent
 * database that is meant to be independent of the agent; a row pointing at the
 * wrong recommendation would quietly corrupt exactly that.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    const ctx = await buildStorefrontContext({
      actor: toAgentActor(actor),
      conversationId: body.conversationId,
      slug: body.slug,
    });

    const feedback = await recordFeedback(ctx, {
      note: body.note,
      recommendationId: body.recommendationId,
      thumbs: body.thumbs,
    });

    return ok({
      feedbackId: feedback.id,
      // Echoed so a client can tell whether the recommendation it named was
      // accepted or silently ignored as not belonging to this conversation.
      recommendationId: feedback.recommendationId,
      recorded: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
