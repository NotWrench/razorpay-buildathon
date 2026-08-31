import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 of `payload` keyed with `secret`, hex encoded. */
export function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison of two hex digests. */
function safeEquals(a: string, b: string): boolean {
  const expected = Buffer.from(a, "utf8");
  const actual = Buffer.from(b, "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

/**
 * Verifies the signature returned by Razorpay Checkout after a successful
 * payment: `HMAC(order_id + "|" + payment_id, key_secret)`.
 */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;

  return safeEquals(sign(payload, params.keySecret), params.signature);
}

/**
 * Verifies the signature Razorpay appends to the payment link `callback_url`:
 * `HMAC(payment_link_id|payment_link_reference_id|payment_link_status|payment_id)`.
 */
export function verifyPaymentLinkSignature(params: {
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = [
    params.paymentLinkId,
    params.paymentLinkReferenceId,
    params.paymentLinkStatus,
    params.razorpayPaymentId,
  ].join("|");

  return safeEquals(sign(payload, params.keySecret), params.signature);
}

/**
 * Verifies the `x-razorpay-signature` header of an incoming webhook against the
 *raw* request body. The body must not be re-serialized before hashing.
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  return safeEquals(
    sign(params.rawBody, params.webhookSecret),
    params.signature
  );
}
