import {
  markPaymentCaptured,
  resolvePaymentContext,
  verifyPaymentLinkCallback,
} from "@workspace/payments";
import { type NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/respond";

/**
 * GET /api/payments/links/callback
 *
 * Redirect target for a completed Payment Link. Razorpay appends the payment
 * identifiers and a signature as query parameters; we verify them, settle the
 * order, and bounce the customer to the order page.
 *
 * The webhook remains the source of truth — this route only makes the happy
 * path feel instant.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const paymentLinkId = params.get("razorpay_payment_link_id");
  const referenceId = params.get("razorpay_payment_link_reference_id");
  const status = params.get("razorpay_payment_link_status");
  const paymentId = params.get("razorpay_payment_id");
  const signature = params.get("razorpay_signature");

  if (!(paymentLinkId && referenceId && status && paymentId && signature)) {
    return NextResponse.redirect(
      new URL("/checkout/failed?reason=missing_parameters", request.nextUrl)
    );
  }

  try {
    const order = await verifyPaymentLinkCallback({
      paymentLinkId,
      paymentLinkReferenceId: referenceId,
      paymentLinkStatus: status,
      razorpayPaymentId: paymentId,
      signature,
    });

    if (status === "paid") {
      const context = await resolvePaymentContext({ orderId: order.id });

      await markPaymentCaptured(context, { razorpayPaymentId: paymentId });
    }

    return NextResponse.redirect(
      new URL(`/checkout/success?orderId=${order.id}`, request.nextUrl)
    );
  } catch (error) {
    if (request.nextUrl.searchParams.get("format") === "json") {
      return handleRouteError(error);
    }

    return NextResponse.redirect(
      new URL("/checkout/failed?reason=verification_failed", request.nextUrl)
    );
  }
}
