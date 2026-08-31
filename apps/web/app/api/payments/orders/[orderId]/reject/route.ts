import { getOrderOrThrow, rejectOrder } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z
  .object({ explanation: z.string().max(2000).optional() })
  .optional();

/**
 * POST /api/payments/orders/{orderId}/reject
 *
 * Merchant declines an agent purchase; the order is cancelled and the reason is
 * written to the failure log so the agent can explain itself to the buyer.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/payments/orders/[orderId]/reject">
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { orderId } = await ctx.params;
    const order = await getOrderOrThrow(orderId);

    await assertMerchantOwner(actor, order.merchantId);

    const body = bodySchema.parse(await request.json().catch(() => undefined));

    const rejected = await rejectOrder({
      actorId: actor.userId ?? actor.identifier,
      explanation: body?.explanation,
      orderId,
    });

    return ok({ order: rejected });
  } catch (error) {
    return handleRouteError(error);
  }
}
