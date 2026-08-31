import { getOrderSummary, PaymentError } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/api/actor";
import { isMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * GET /api/payments/orders/{orderId}
 *
 * Order, line items and payment attempts. Visible to the buyer that created the
 * order and to the merchant that owns it.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/payments/orders/[orderId]">
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { orderId } = await ctx.params;
    const summary = await getOrderSummary(orderId);

    const isBuyer = summary.order.buyerIdentifier === actor.identifier;
    const isMerchant = await isMerchantOwner(actor, summary.order.merchantId);

    if (!(isBuyer || isMerchant)) {
      throw new PaymentError(
        "ORDER_NOT_FOUND",
        `No order found for ${orderId}`
      );
    }

    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
