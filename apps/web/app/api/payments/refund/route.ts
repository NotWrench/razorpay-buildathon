import { refundPayment, resolvePaymentContext } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  /** Paise. Omit for a full refund. */
  amount: z.number().int().positive().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  razorpayPaymentId: z.string().min(1),
  speed: z.enum(["normal", "optimum"]).optional(),
});

/**
 * POST /api/payments/refund
 *
 * Full or partial refund of a captured payment. Merchant-only.
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

    const refund = await refundPayment({
      amount: body.amount,
      notes: body.notes,
      razorpayPaymentId: body.razorpayPaymentId,
      speed: body.speed,
    });

    return ok({
      amount: refund.amount,
      orderId: order.id,
      refundId: refund.id,
      status: refund.status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
