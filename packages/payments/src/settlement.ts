import {
  db,
  type Order,
  orderItems,
  orders,
  type Payment,
  payments,
  products,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { recordAudit, recordFailure } from "./audit";
import { PaymentError } from "./errors";

export interface PaymentContext {
  order: Order;
  payment: Payment;
}

export interface PaymentLocator {
  orderId?: string;
  paymentLinkId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

/**
 * Finds the payment attempt and its order from whichever Razorpay identifier
 * the caller has: a Razorpay order id, a payment link id, or our own order id.
 */
export async function resolvePaymentContext(
  locator: PaymentLocator
): Promise<PaymentContext> {
  let payment: Payment | undefined;

  if (locator.razorpayOrderId) {
    payment = await db.query.payments.findFirst({
      where: eq(payments.razorpayOrderId, locator.razorpayOrderId),
    });
  }

  if (!payment && locator.razorpayPaymentId) {
    payment = await db.query.payments.findFirst({
      where: eq(payments.razorpayPaymentId, locator.razorpayPaymentId),
    });
  }

  if (!payment && locator.paymentLinkId) {
    payment = await db.query.payments.findFirst({
      where: eq(payments.paymentLinkId, locator.paymentLinkId),
    });
  }

  if (!payment && locator.orderId) {
    payment = await db.query.payments.findFirst({
      where: eq(payments.orderId, locator.orderId),
    });
  }

  if (!payment) {
    throw new PaymentError(
      "PAYMENT_NOT_FOUND",
      "No payment attempt matches the supplied Razorpay identifiers",
      locator
    );
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, payment.orderId),
  });

  if (!order) {
    throw new PaymentError(
      "ORDER_NOT_FOUND",
      `Payment ${payment.id} points at a missing order`
    );
  }

  return { order, payment };
}

/** Decrements stock for every line of an order. Called once, on first capture. */
async function drawDownStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orderId: string
): Promise<void> {
  const lines = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  await Promise.all(
    lines.map((line) =>
      tx
        .update(products)
        .set({ stock: sql`GREATEST(${products.stock} - ${line.quantity}, 0)` })
        .where(eq(products.id, line.productId))
    )
  );
}

/**
 * Moves a payment to `authorized`. The money is held but not yet captured —
 * used for the manual-capture flow and the `payment.authorized` webhook.
 */
export async function markPaymentAuthorized(
  context: PaymentContext,
  input: { razorpayPaymentId: string; signature?: string | null }
): Promise<PaymentContext> {
  if (context.payment.status === "captured") {
    return context;
  }

  const [payment] = await db
    .update(payments)
    .set({
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.signature ?? context.payment.razorpaySignature,
      status: "authorized",
    })
    .where(eq(payments.id, context.payment.id))
    .returning();

  await recordAudit({
    action: "PAYMENT_AUTHORIZED",
    actorId: context.order.buyerIdentifier,
    actorType:
      context.order.buyerType === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `Payment ${input.razorpayPaymentId} authorized for order ${context.order.id}`,
    merchantId: context.order.merchantId,
    metadata: { razorpayPaymentId: input.razorpayPaymentId },
    orderId: context.order.id,
  });

  return { order: context.order, payment: payment ?? context.payment };
}

/**
 * Terminal success state: marks the payment captured, the order paid and draws
 * down stock. Safe to call repeatedly — later calls are no-ops.
 */
export async function markPaymentCaptured(
  context: PaymentContext,
  input: {
    amount?: number;
    razorpayPaymentId: string;
    signature?: string | null;
  }
): Promise<PaymentContext> {
  if (context.payment.status === "captured") {
    return context;
  }

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .update(payments)
      .set({
        amount: input.amount ?? context.payment.amount,
        failureReason: null,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.signature ?? context.payment.razorpaySignature,
        status: "captured",
      })
      .where(eq(payments.id, context.payment.id))
      .returning();

    const [order] = await tx
      .update(orders)
      .set({ orderStatus: "paid" })
      .where(eq(orders.id, context.order.id))
      .returning();

    if (context.order.orderStatus !== "paid") {
      await drawDownStock(tx, context.order.id);
    }

    return {
      order: order ?? context.order,
      payment: payment ?? context.payment,
    };
  });

  await recordAudit({
    action: "PAYMENT_CAPTURED",
    actorId: context.order.buyerIdentifier,
    actorType:
      context.order.buyerType === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `Payment ${input.razorpayPaymentId} captured for order ${context.order.id}; stock reserved`,
    merchantId: context.order.merchantId,
    metadata: {
      amount: input.amount ?? context.payment.amount,
      razorpayPaymentId: input.razorpayPaymentId,
    },
    orderId: context.order.id,
  });

  return result;
}

/** Records a declined or abandoned payment and keeps the order retryable. */
export async function markPaymentFailed(
  context: PaymentContext,
  input: {
    failureReason: string;
    razorpayPaymentId?: string | null;
  }
): Promise<PaymentContext> {
  if (context.payment.status === "captured") {
    return context;
  }

  const [payment] = await db
    .update(payments)
    .set({
      failureReason: input.failureReason,
      razorpayPaymentId:
        input.razorpayPaymentId ?? context.payment.razorpayPaymentId,
      retryCount: context.payment.retryCount + 1,
      status: "failed",
    })
    .where(eq(payments.id, context.payment.id))
    .returning();

  const [order] = await db
    .update(orders)
    .set({ orderStatus: "failed" })
    .where(eq(orders.id, context.order.id))
    .returning();

  await recordFailure({
    errorMessage: input.failureReason,
    errorType: "PAYMENT_DECLINED",
    orderId: context.order.id,
    recoveryAction: "RETRY_LINK_AVAILABLE",
  });

  await recordAudit({
    action: "PAYMENT_FAILED",
    actorId: context.order.buyerIdentifier,
    actorType:
      context.order.buyerType === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `Payment failed for order ${context.order.id}: ${input.failureReason}`,
    merchantId: context.order.merchantId,
    orderId: context.order.id,
  });

  return { order: order ?? context.order, payment: payment ?? context.payment };
}

export async function markPaymentRefunded(
  context: PaymentContext,
  input: { amount?: number; reason?: string }
): Promise<PaymentContext> {
  const [payment] = await db
    .update(payments)
    .set({ status: "refunded" })
    .where(eq(payments.id, context.payment.id))
    .returning();

  await recordAudit({
    action: "PAYMENT_REFUNDED",
    actorId: "system",
    actorType: "system",
    explanation:
      input.reason ?? `Refund processed for order ${context.order.id}`,
    merchantId: context.order.merchantId,
    metadata: { amount: input.amount },
    orderId: context.order.id,
  });

  return { order: context.order, payment: payment ?? context.payment };
}
