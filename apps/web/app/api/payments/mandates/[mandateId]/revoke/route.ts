import { buyerMandates, db } from "@workspace/db";
import { PaymentError, revokeMandate } from "@workspace/payments";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/api/actor";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * POST /api/payments/mandates/{mandateId}/revoke
 *
 * Taking it back.
 *
 * The half of a delegation that makes the other half safe to give. An
 * authorisation you cannot withdraw is not a bounded permission, it is a
 * standing one — and the whole claim this feature makes is that the buyer
 * stays in control of an agent that no longer stops to ask them.
 *
 * The next charge refuses, immediately and by the mandate's own rule rather
 * than by anything remembered here: `checkMandate` reads `revokedAt` before it
 * reads any cap.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/payments/mandates/[mandateId]/revoke">
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { mandateId } = await ctx.params;

    const mandate = await db.query.buyerMandates.findFirst({
      where: eq(buyerMandates.id, mandateId),
    });

    /*
     * Ownership is checked here rather than inside `revokeMandate`, which is
     * also called from places that have already established who is asking. The
     * wording does not distinguish "no such mandate" from "not yours", for the
     * same reason the order lookup does not.
     */
    if (!mandate || mandate.buyerIdentifier !== actor.identifier) {
      throw new PaymentError(
        "MANDATE_REFUSED",
        "No such authorisation on this account."
      );
    }

    const revoked = await revokeMandate({
      actorId: actor.identifier,
      mandateId,
    });

    return ok({ mandate: revoked });
  } catch (error) {
    return handleRouteError(error);
  }
}
