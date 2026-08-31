import {
  captureAuthorizedPayment,
  resolvePaymentContext,
} from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  /** Paise. Defaults to the full authorized amount. */
  amount: z.number().int().positive().optional(),
  razorpayPaymentId: z.string().min(1),
});

/**
 * POST /api/payments/capture
 *
 * Manual capture of an authorized payment. Only needed when the merchant's
 * Razorpay account has auto-capture switched off.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());
    const { order } = await resolvePaymentContext({
      razorpayPaymentId: body.razorpayPaymentId,
    });

    await assertMerchantOwner(actor, order.merchantId);

    const { order: settled, payment } = await captureAuthorizedPayment({
      amount: body.amount,
      razorpayPaymentId: body.razorpayPaymentId,
    });

    return ok({
      orderId: settled.id,
      orderStatus: settled.orderStatus,
      paymentStatus: payment.status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
