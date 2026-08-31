import { approveOrder, getOrderOrThrow } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z
  .object({ explanation: z.string().max(2000).optional() })
  .optional();

/**
 * POST /api/payments/orders/{orderId}/approve
 *
 * Human-in-the-loop approval of an agent purchase. Activating the order creates
 * the Razorpay order, so the response carries the checkout handoff.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/payments/orders/[orderId]/approve">
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

    const result = await approveOrder({
      actorId: actor.userId ?? actor.identifier,
      explanation: body?.explanation,
      orderId,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
