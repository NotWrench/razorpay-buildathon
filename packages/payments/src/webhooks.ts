import { getPlatformWebhookSecret } from "./env";
import { PaymentError } from "./errors";
import {
  markPaymentAuthorized,
  markPaymentCaptured,
  markPaymentFailed,
  markPaymentRefunded,
  type PaymentLocator,
  resolvePaymentContext,
} from "./settlement";
import { verifyWebhookSignature } from "./signature";

export interface RazorpayWebhookEvent {
  account_id?: string;
  contains: string[];
  created_at: number;
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    payment_link?: { entity: RazorpayPaymentLinkEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
}

interface RazorpayPaymentEntity {
  amount: number;
  currency: string;
  error_description?: string | null;
  error_reason?: string | null;
  id: string;
  notes?: Record<string, string>;
  order_id: string | null;
  status: string;
}

interface RazorpayPaymentLinkEntity {
  id: string;
  order_id?: string | null;
  reference_id?: string | null;
  status: string;
}

interface RazorpayRefundEntity {
  amount: number;
  id: string;
  payment_id: string;
}

export interface WebhookResult {
  event: string;
  handled: boolean;
  orderId?: string;
}

/** Builds the lookup keys we can use to find our own records for an event. */
function locatorFor(event: RazorpayWebhookEvent): PaymentLocator {
  const payment = event.payload.payment?.entity;
  const link = event.payload.payment_link?.entity;

  return {
    orderId: payment?.notes?.orderId ?? link?.reference_id ?? undefined,
    paymentLinkId: link?.id,
    razorpayOrderId: payment?.order_id ?? link?.order_id ?? undefined,
  };
}

async function handlePaymentEvent(
  event: RazorpayWebhookEvent
): Promise<WebhookResult> {
  const entity = event.payload.payment?.entity;

  if (!entity) {
    return { event: event.event, handled: false };
  }

  const context = await resolvePaymentContext(locatorFor(event));

  if (event.event === "payment.captured" || entity.status === "captured") {
    const settled = await markPaymentCaptured(context, {
      amount: entity.amount,
      razorpayPaymentId: entity.id,
    });

    return { event: event.event, handled: true, orderId: settled.order.id };
  }

  if (event.event === "payment.failed") {
    const settled = await markPaymentFailed(context, {
      failureReason:
        entity.error_description ?? entity.error_reason ?? "Payment failed",
      razorpayPaymentId: entity.id,
    });

    return { event: event.event, handled: true, orderId: settled.order.id };
  }

  const settled = await markPaymentAuthorized(context, {
    razorpayPaymentId: entity.id,
  });

  return { event: event.event, handled: true, orderId: settled.order.id };
}

async function handlePaymentLinkEvent(
  event: RazorpayWebhookEvent
): Promise<WebhookResult> {
  const link = event.payload.payment_link?.entity;
  const payment = event.payload.payment?.entity;

  if (!link) {
    return { event: event.event, handled: false };
  }

  const context = await resolvePaymentContext(locatorFor(event));

  if (event.event === "payment_link.paid" && payment) {
    const settled = await markPaymentCaptured(context, {
      amount: payment.amount,
      razorpayPaymentId: payment.id,
    });

    return { event: event.event, handled: true, orderId: settled.order.id };
  }

  const settled = await markPaymentFailed(context, {
    failureReason: `Payment link ${link.id} ${link.status}`,
    razorpayPaymentId: payment?.id ?? null,
  });

  return { event: event.event, handled: true, orderId: settled.order.id };
}

async function handleRefundEvent(
  event: RazorpayWebhookEvent
): Promise<WebhookResult> {
  const refund = event.payload.refund?.entity;
  const payment = event.payload.payment?.entity;

  if (!(refund && payment)) {
    return { event: event.event, handled: false };
  }

  const context = await resolvePaymentContext(locatorFor(event));
  const settled = await markPaymentRefunded(context, {
    amount: refund.amount,
    reason: `Refund ${refund.id} processed for payment ${payment.id}`,
  });

  return { event: event.event, handled: true, orderId: settled.order.id };
}

/**
 * Verifies and applies an incoming Razorpay webhook.
 *
 * `rawBody` must be the untouched request body string — re-serializing the
 * parsed JSON changes the bytes and breaks the HMAC.
 */
export async function handleRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
  webhookSecret?: string;
}): Promise<WebhookResult> {
  const secret = input.webhookSecret ?? getPlatformWebhookSecret();

  if (!input.signature) {
    throw new PaymentError(
      "INVALID_SIGNATURE",
      "Missing x-razorpay-signature header"
    );
  }

  const valid = verifyWebhookSignature({
    rawBody: input.rawBody,
    signature: input.signature,
    webhookSecret: secret,
  });

  if (!valid) {
    throw new PaymentError(
      "INVALID_SIGNATURE",
      "Webhook signature verification failed"
    );
  }

  const event = JSON.parse(input.rawBody) as RazorpayWebhookEvent;

  if (event.event.startsWith("payment_link.")) {
    return await handlePaymentLinkEvent(event);
  }

  if (event.event.startsWith("refund.")) {
    return await handleRefundEvent(event);
  }

  if (event.event.startsWith("payment.")) {
    return await handlePaymentEvent(event);
  }

  if (event.event === "order.paid") {
    return await handlePaymentEvent(event);
  }

  return { event: event.event, handled: false };
}
