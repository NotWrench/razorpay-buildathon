import { db, payments } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Payments } from "razorpay/dist/types/payments";
import { getMerchantGateway } from "./client";
import { PaymentError, toPaymentError } from "./errors";
import {
  markPaymentCaptured,
  markPaymentFailed,
  markPaymentRefunded,
  type PaymentContext,
  resolvePaymentContext,
} from "./settlement";
import { verifyCheckoutSignature } from "./signature";

export interface VerifyCheckoutInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}

/**
 * Server-side confirmation of a Razorpay Checkout handshake.
 *
 * The client-side `handler` callback is not trustworthy on its own: the
 * signature is verified against the merchant's key secret, and the payment is
 * then re-fetched from Razorpay so the recorded status reflects the gateway,
 * not the caller.
 */
export async function verifyCheckoutPayment(
  input: VerifyCheckoutInput
): Promise<PaymentContext> {
  const context = await resolvePaymentContext({
    razorpayOrderId: input.razorpayOrderId,
  });
  const gateway = await getMerchantGateway(context.order.merchantId);

  const valid = verifyCheckoutSignature({
    keySecret: gateway.credentials.keySecret,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    signature: input.signature,
  });

  if (!valid) {
    await markPaymentFailed(context, {
      failureReason: "Checkout signature verification failed",
      razorpayPaymentId: input.razorpayPaymentId,
    });

    throw new PaymentError(
      "INVALID_SIGNATURE",
      "Razorpay checkout signature did not match"
    );
  }

  let remote: Payments.RazorpayPayment;

  try {
    remote = await gateway.client.payments.fetch(input.razorpayPaymentId);
  } catch (error) {
    throw toPaymentError(error);
  }

  if (remote.status === "failed") {
    return await markPaymentFailed(context, {
      failureReason:
        remote.error_description ?? "Payment failed at the gateway",
      razorpayPaymentId: input.razorpayPaymentId,
    });
  }

  return await markPaymentCaptured(context, {
    amount: Number(remote.amount),
    razorpayPaymentId: input.razorpayPaymentId,
    signature: input.signature,
  });
}

/**
 * Captures a previously authorized payment. Only needed when the Razorpay
 * account is configured for manual capture — the default is auto-capture.
 */
export async function captureAuthorizedPayment(input: {
  amount?: number;
  razorpayPaymentId: string;
}): Promise<PaymentContext> {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.razorpayPaymentId, input.razorpayPaymentId),
  });

  if (!payment) {
    throw new PaymentError(
      "PAYMENT_NOT_FOUND",
      `No payment attempt for ${input.razorpayPaymentId}`
    );
  }

  const context = await resolvePaymentContext({ orderId: payment.orderId });
  const gateway = await getMerchantGateway(context.order.merchantId);
  const amount = input.amount ?? payment.amount;

  try {
    const captured = await gateway.client.payments.capture(
      input.razorpayPaymentId,
      amount,
      payment.currency
    );

    return await markPaymentCaptured(context, {
      amount: Number(captured.amount),
      razorpayPaymentId: input.razorpayPaymentId,
    });
  } catch (error) {
    throw toPaymentError(error);
  }
}

/** Refunds a captured payment, fully or partially. */
export async function refundPayment(input: {
  /** Amount in paise. Omit for a full refund. */
  amount?: number;
  notes?: Record<string, string>;
  razorpayPaymentId: string;
  speed?: "normal" | "optimum";
}) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.razorpayPaymentId, input.razorpayPaymentId),
  });

  if (!payment) {
    throw new PaymentError(
      "PAYMENT_NOT_FOUND",
      `No payment attempt for ${input.razorpayPaymentId}`
    );
  }

  const context = await resolvePaymentContext({ orderId: payment.orderId });
  const gateway = await getMerchantGateway(context.order.merchantId);

  try {
    const refund = await gateway.client.payments.refund(
      input.razorpayPaymentId,
      {
        amount: input.amount,
        notes: input.notes,
        speed: input.speed ?? "normal",
      }
    );

    await markPaymentRefunded(context, {
      amount: Number(refund.amount),
      reason: `Refund ${refund.id} created for payment ${input.razorpayPaymentId}`,
    });

    return refund;
  } catch (error) {
    throw toPaymentError(error);
  }
}

/** Live payment state for an order, straight from our own records. */
export async function getPaymentStatus(orderId: string) {
  const context = await resolvePaymentContext({ orderId });

  return {
    approvalStatus: context.order.approvalStatus,
    orderStatus: context.order.orderStatus,
    payment: context.payment,
  };
}
