import { verifyCheckoutPayment } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api/respond";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * POST /api/payments/verify
 *
 * Called from the Razorpay Checkout success handler. The signature is the proof
 * of authenticity here, so no session is required — an attacker cannot forge one
 * without the merchant's key secret.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = bodySchema.parse(await request.json());

    const { order, payment } = await verifyCheckoutPayment({
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });

    return ok({
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentStatus: payment.status,
      verified: payment.status === "captured",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
