import { db, payments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordAudit } from "./audit";
import { getMerchantGateway } from "./client";
import { isTestKeyId } from "./mode";
import { getAppUrl } from "./env";
import { PaymentError, toPaymentError } from "./errors";
import { getOrderOrThrow } from "./orders";
import { resolvePaymentContext } from "./settlement";
import { verifyPaymentLinkSignature } from "./signature";

export interface CreatePaymentLinkInput {
  /** Overrides the default `${APP_URL}/checkout/callback`. */
  callbackUrl?: string;
  customer?: { contact?: string; email?: string; name?: string };
  description?: string;
  /** Unix seconds. Defaults to 24 hours out. */
  expireBy?: number;
  notify?: { email?: boolean; sms?: boolean };
  orderId: string;
}

const DAY_IN_SECONDS = 24 * 60 * 60;

/**
 * The hosted link is a page a human opens on their own phone, often hours
 * later and with no other context. Razorpay draws no test badge on it, so the
 * description is the only place the page can say that the money is not real.
 */
function describe(description: string, keyId: string): string {
  return isTestKeyId(keyId) ? `[Test mode] ${description}` : description;
}

/**
 * Creates a hosted Razorpay Payment Link for an approved order.
 *
 * This is the handoff used for AI-agent purchases: the agent never touches card
 * data, it just receives a URL for the human to complete payment on.
 */
export async function createPaymentLinkForOrder(input: CreatePaymentLinkInput) {
  const order = await getOrderOrThrow(input.orderId);

  if (order.approvalStatus !== "approved") {
    throw new PaymentError(
      "ORDER_NOT_APPROVED",
      "The order still needs merchant approval before it can be paid"
    );
  }

  if (order.orderStatus === "paid") {
    throw new PaymentError("ORDER_ALREADY_PAID", "Order is already paid");
  }

  const gateway = await getMerchantGateway(order.merchantId);
  const context = await resolvePaymentContext({ orderId: order.id });

  if (context.payment.paymentLinkUrl && context.payment.status === "created") {
    return {
      paymentLinkId: context.payment.paymentLinkId,
      paymentLinkUrl: context.payment.paymentLinkUrl,
      reused: true,
    };
  }

  try {
    const link = await gateway.client.paymentLink.create({
      amount: order.totalAmount,
      callback_method: "get",
      callback_url:
        input.callbackUrl ?? `${getAppUrl()}/api/payments/links/callback`,
      currency: order.currency,
      customer: {
        contact: input.customer?.contact,
        email: input.customer?.email,
        name: input.customer?.name,
      },
      description: describe(
        input.description ?? `Payment for order ${order.id}`,
        gateway.credentials.keyId
      ),
      expire_by:
        input.expireBy ?? Math.floor(Date.now() / 1000) + DAY_IN_SECONDS,
      notify: {
        email: input.notify?.email ?? Boolean(input.customer?.email),
        sms: input.notify?.sms ?? false,
      },
      reference_id: order.id,
      reminder_enable: true,
    });

    await db
      .update(payments)
      .set({ paymentLinkId: link.id, paymentLinkUrl: link.short_url })
      .where(eq(payments.id, context.payment.id));

    await recordAudit({
      action: "PAYMENT_LINK_CREATED",
      actorId: order.buyerIdentifier,
      actorType:
        order.buyerType === "human" ? "human_buyer" : "external_ai_agent",
      explanation: `Payment link ${link.id} issued for order ${order.id}`,
      merchantId: order.merchantId,
      metadata: { paymentLinkId: link.id, paymentLinkUrl: link.short_url },
      orderId: order.id,
    });

    return {
      paymentLinkId: link.id,
      paymentLinkUrl: link.short_url,
      reused: false,
    };
  } catch (error) {
    throw toPaymentError(error);
  }
}

/** Verifies the query parameters Razorpay appends to a payment link callback. */
export async function verifyPaymentLinkCallback(input: {
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  razorpayPaymentId: string;
  signature: string;
}) {
  const order = await getOrderOrThrow(input.paymentLinkReferenceId);
  const gateway = await getMerchantGateway(order.merchantId);

  const valid = verifyPaymentLinkSignature({
    keySecret: gateway.credentials.keySecret,
    paymentLinkId: input.paymentLinkId,
    paymentLinkReferenceId: input.paymentLinkReferenceId,
    paymentLinkStatus: input.paymentLinkStatus,
    razorpayPaymentId: input.razorpayPaymentId,
    signature: input.signature,
  });

  if (!valid) {
    throw new PaymentError(
      "INVALID_SIGNATURE",
      "Payment link signature did not match"
    );
  }

  return order;
}

/** Cancels an open payment link (e.g. after the merchant rejects an order). */
export async function cancelPaymentLink(paymentLinkId: string) {
  const context = await resolvePaymentContext({ paymentLinkId });
  const gateway = await getMerchantGateway(context.order.merchantId);

  try {
    return await gateway.client.paymentLink.cancel(paymentLinkId);
  } catch (error) {
    throw toPaymentError(error);
  }
}
