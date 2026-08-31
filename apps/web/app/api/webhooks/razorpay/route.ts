import { handleRazorpayWebhook, PaymentError } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/lib/api/respond";

/** Webhooks must hit the Node runtime — signature verification uses node:crypto. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/razorpay
 *
 * Source of truth for payment state. Configure this URL in the Razorpay
 * dashboard with the events: `payment.authorized`, `payment.captured`,
 * `payment.failed`, `order.paid`, `payment_link.paid`, `payment_link.expired`
 * and `refund.processed`.
 *
 * Handlers are idempotent, so Razorpay's retries are safe.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // The raw body is required: re-serializing the JSON breaks the HMAC.
    const rawBody = await request.text();

    const result = await handleRazorpayWebhook({
      rawBody,
      signature: request.headers.get("x-razorpay-signature"),
    });

    return ok(result);
  } catch (error) {
    // A signature mismatch is a 400 so Razorpay stops retrying; anything else
    // returns its natural status and gets retried.
    if (error instanceof PaymentError && error.code === "PAYMENT_NOT_FOUND") {
      // Event for an order we do not know about — acknowledge and move on.
      return ok({ handled: false, reason: "unknown_order" });
    }

    return handleRouteError(error);
  }
}
