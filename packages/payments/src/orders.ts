import {
  db,
  isUuid,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  payments,
  products,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { type ApprovalDecision, resolveOrderApproval } from "./approval-policy";
import { recordAudit, recordFailure } from "./audit";
import { getMerchantGateway, type MerchantGateway } from "./client";
import { PaymentError, toPaymentError } from "./errors";

export type BuyerType = "human" | "ai_agent";

export interface CartLine {
  isUpsell?: boolean;
  productId: string;
  quantity: number;
}

export interface CreateCheckoutOrderInput {
  /** Explainability record for agent-initiated purchases. */
  aiPurchaseReason?: string;
  /**
   * The unattended ceiling on the API key that placed this order.
   *
   * The merchant chose it per counterparty when they issued the key, so it can
   * only tighten what the store-wide policy already allows. Absent for a
   * signed-in person and for keys issued before the field existed, which falls
   * back to the store's own number rather than to nothing.
   */
  autoApproveCeilingPaise?: number;
  buyerIdentifier: string;
  buyerType: BuyerType;
  /**
   * The campaign the discount came from, when one applied.
   *
   * Written from what the quote actually used, so "did that campaign work?"
   * reads the orders the campaign really touched rather than guessing from
   * dates. Null for an undiscounted order and for a discount that came from
   * somewhere else.
   */
  campaignId?: string | null;
  /** Discount in the smallest currency unit (paise). */
  discountAmount?: number;
  items: CartLine[];
  merchantId: string;
  notes?: Record<string, string>;
  /** Owning app user, when the buyer is signed in. */
  userId?: string | null;
}

export interface CheckoutHandoff {
  amount: number;
  currency: string;
  keyId: string;
  razorpayOrderId: string;
}

export interface CheckoutOrder {
  /** Present once the order is approved and a Razorpay order exists. */
  checkout: CheckoutHandoff | null;
  items: OrderItem[];
  order: Order;
}

/*
 * The approval decision used to live here as `initialApprovalStatus`, a
 * one-line function of `buyerType` that consulted nothing. It now lives in
 * `approval-policy.ts`, where it can read what the merchant actually decided —
 * see the comment there for why the gap mattered.
 */

/** Prices the cart against live product rows and validates availability. */
async function priceCart(merchantId: string, items: CartLine[]) {
  if (items.length === 0) {
    throw new PaymentError(
      "EMPTY_CART",
      "Cannot create an order with no items"
    );
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const rows = await db
    .select()
    .from(products)
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, productIds))
    );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines = items.map((item) => {
    const product = byId.get(item.productId);

    if (!product?.isActive) {
      throw new PaymentError(
        "PRODUCT_NOT_FOUND",
        `Product ${item.productId} is unavailable for this merchant`
      );
    }

    if (item.quantity < 1) {
      throw new PaymentError(
        "EMPTY_CART",
        `Quantity for product ${item.productId} must be at least 1`
      );
    }

    if (product.stock < item.quantity) {
      throw new PaymentError(
        "OUT_OF_STOCK",
        `Only ${product.stock} unit(s) of ${product.name} left in stock`,
        { available: product.stock, productId: product.id }
      );
    }

    return {
      isUpsell: item.isUpsell ?? false,
      productId: product.id,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
      unitPrice: product.price,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);

  return { lines, subtotal };
}

/** Creates the Razorpay order that backs a persisted order row. */
async function createRazorpayOrder(
  gateway: MerchantGateway,
  order: Order,
  notes?: Record<string, string>
) {
  try {
    return await gateway.client.orders.create({
      amount: order.totalAmount,
      currency: order.currency,
      notes: {
        buyerIdentifier: order.buyerIdentifier,
        buyerType: order.buyerType,
        merchantId: order.merchantId,
        orderId: order.id,
        ...notes,
      },
      receipt: order.id,
    });
  } catch (error) {
    throw toPaymentError(error);
  }
}

/**
 * Creates the Razorpay order and the pending payment row for an approved
 * order. Idempotent: an order that already has a Razorpay id is returned as-is.
 */
async function activateOrder(
  order: Order,
  gateway: MerchantGateway,
  notes?: Record<string, string>
): Promise<Order> {
  if (order.razorpayOrderId) {
    return order;
  }

  const razorpayOrder = await createRazorpayOrder(gateway, order, notes);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({ orderStatus: "created", razorpayOrderId: razorpayOrder.id })
      .where(eq(orders.id, order.id))
      .returning();

    await tx.insert(payments).values({
      amount: order.totalAmount,
      currency: order.currency,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      status: "created",
    });

    return row;
  });

  if (!updated) {
    throw new PaymentError("ORDER_NOT_FOUND", "Failed to activate the order");
  }

  await recordAudit({
    action: "RAZORPAY_ORDER_CREATED",
    actorId: "system",
    actorType: "system",
    explanation: `Razorpay order ${razorpayOrder.id} created for order ${order.id}`,
    merchantId: order.merchantId,
    metadata: { razorpayOrderId: razorpayOrder.id },
    orderId: order.id,
  });

  return updated;
}

function toHandoff(order: Order, gateway: MerchantGateway): CheckoutHandoff {
  if (!order.razorpayOrderId) {
    throw new PaymentError(
      "ORDER_NOT_APPROVED",
      "Order has no Razorpay order yet"
    );
  }

  return {
    amount: order.totalAmount,
    currency: order.currency,
    keyId: gateway.credentials.keyId,
    razorpayOrderId: order.razorpayOrderId,
  };
}

/**
 * An agent order that cleared without a human, said out loud.
 *
 * `/manager/activity` is one stream because the question a merchant has is
 * "who changed this", and an order nobody approved has to answer it too. The
 * entry names the delegation that cleared it and the ceiling it cleared under,
 * so the merchant reads a decision they made rather than an absence of one.
 *
 * Human checkouts are skipped: a person buying their own cart is not a
 * delegation, and stamping one on every storefront order would bury the rows
 * that matter.
 */
async function recordAutoApproval(
  order: Order,
  buyerType: BuyerType,
  approval: ApprovalDecision
): Promise<void> {
  if (buyerType === "human") {
    return;
  }

  await recordAudit({
    action: "ORDER_AUTO_APPROVED",
    actorId: "system",
    actorType: "system",
    explanation: approval.explanation,
    merchantId: order.merchantId,
    metadata: {
      ceilingPaise: approval.ceilingPaise,
      totalAmount: order.totalAmount,
    },
    orderId: order.id,
  });
}

/**
 * Persists an order and its line items, then — when the buyer does not need
 * merchant approval — creates the matching Razorpay order.
 */
export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput
): Promise<CheckoutOrder> {
  const gateway = await getMerchantGateway(input.merchantId);
  const { lines, subtotal } = await priceCart(input.merchantId, input.items);
  const discountAmount = Math.min(
    Math.max(input.discountAmount ?? 0, 0),
    subtotal
  );
  const totalAmount = subtotal - discountAmount;

  // Decided before the insert, on the total the buyer will actually pay, so
  // the row is written already knowing whether a human is owed a look at it.
  const approval = await resolveOrderApproval({
    buyerType: input.buyerType,
    keyCeilingPaise: input.autoApproveCeilingPaise,
    merchantId: input.merchantId,
    totalAmount,
  });

  const { order, items } = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        aiPurchaseReason: input.aiPurchaseReason ?? null,
        approvalStatus: approval.status,
        buyerIdentifier: input.buyerIdentifier,
        buyerType: input.buyerType,
        campaignId: discountAmount > 0 ? (input.campaignId ?? null) : null,
        currency: gateway.merchant.currency,
        discountAmount,
        merchantId: input.merchantId,
        orderStatus: "draft",
        subtotal,
        totalAmount,
        userId: input.userId ?? null,
      })
      .returning();

    if (!created) {
      throw new PaymentError("ORDER_NOT_FOUND", "Failed to persist the order");
    }

    const insertedItems = await tx
      .insert(orderItems)
      .values(lines.map((line) => ({ ...line, orderId: created.id })))
      .returning();

    return { items: insertedItems, order: created };
  });

  await recordAudit({
    action: "ORDER_CREATED",
    actorId: input.buyerIdentifier,
    actorType:
      input.buyerType === "human" ? "human_buyer" : "external_ai_agent",
    explanation:
      input.aiPurchaseReason ??
      `Order created with ${items.length} line item(s) totalling ${totalAmount}`,
    merchantId: input.merchantId,
    metadata: { discountAmount, subtotal, totalAmount },
    orderId: order.id,
  });

  if (order.approvalStatus !== "approved") {
    return { checkout: null, items, order };
  }

  await recordAutoApproval(order, input.buyerType, approval);

  const activated = await activateOrder(order, gateway, input.notes);

  return { checkout: toHandoff(activated, gateway), items, order: activated };
}

export async function getOrderOrThrow(orderId: string): Promise<Order> {
  /* Checked before the query, not after: Postgres answers a malformed uuid
     with a driver error rather than an empty set, and every caller here
     wants "no such order" either way. */
  const order = isUuid(orderId)
    ? await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
    : undefined;

  if (!order) {
    throw new PaymentError("ORDER_NOT_FOUND", `No order found for ${orderId}`);
  }

  return order;
}

/**
 * Merchant approval for an agent-initiated purchase. Approving activates the
 * Razorpay order so the buyer can be handed checkout config or a payment link.
 */
export async function approveOrder(params: {
  actorId: string;
  explanation?: string;
  orderId: string;
}): Promise<CheckoutOrder> {
  const order = await getOrderOrThrow(params.orderId);

  if (order.orderStatus === "paid") {
    throw new PaymentError("ORDER_ALREADY_PAID", "Order is already paid");
  }

  const gateway = await getMerchantGateway(order.merchantId);

  const [approved] = await db
    .update(orders)
    .set({ approvalStatus: "approved" })
    .where(eq(orders.id, order.id))
    .returning();

  const activated = await activateOrder(approved ?? order, gateway);

  await recordAudit({
    action: "ORDER_APPROVED",
    actorId: params.actorId,
    actorType: "merchant",
    explanation: params.explanation ?? "Merchant approved the agent purchase",
    merchantId: order.merchantId,
    orderId: order.id,
  });

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return { checkout: toHandoff(activated, gateway), items, order: activated };
}

export async function rejectOrder(params: {
  actorId: string;
  explanation?: string;
  orderId: string;
}): Promise<Order> {
  const order = await getOrderOrThrow(params.orderId);

  if (order.orderStatus === "paid") {
    throw new PaymentError("ORDER_ALREADY_PAID", "Order is already paid");
  }

  const [rejected] = await db
    .update(orders)
    .set({ approvalStatus: "rejected", orderStatus: "cancelled" })
    .where(eq(orders.id, order.id))
    .returning();

  await recordAudit({
    action: "ORDER_REJECTED",
    actorId: params.actorId,
    actorType: "merchant",
    explanation: params.explanation ?? "Merchant rejected the purchase",
    merchantId: order.merchantId,
    orderId: order.id,
  });

  await recordFailure({
    errorMessage: params.explanation ?? "Rejected by merchant",
    errorType: "ORDER_REJECTED",
    orderId: order.id,
  });

  return rejected ?? order;
}

/**
 * The buyer closed the checkout window without paying.
 *
 * An order left at `created` is indistinguishable from one whose window is
 * still open, so an abandoned checkout used to sit in the merchant's list
 * looking like a sale about to happen. Closing the window is an answer, and
 * this records it as one.
 *
 * Only a checkout that touched nothing is cancelled. An attempt that reached
 * the gateway — authorized, captured, or declined — keeps the order alive:
 * money may still be in flight, and a declined card is a retry rather than a
 * change of mind. That is also what makes this safe to call from the modal's
 * dismiss callback, which fires on a close the buyer may have made a second
 * after their payment went through.
 */
export async function abandonCheckout(params: {
  actorId: string;
  orderId: string;
}): Promise<{ cancelled: boolean; order: Order }> {
  const order = await getOrderOrThrow(params.orderId);

  // `created` is the one state this applies to: a Razorpay order exists and
  // nothing has happened to it. `paid`, `failed` and `cancelled` have all
  // already been answered by something better informed than a closed window.
  if (order.orderStatus !== "created") {
    return { cancelled: false, order };
  }

  const attempts = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id));

  const touched = attempts.some(
    (attempt) =>
      attempt.status !== "created" ||
      attempt.razorpayPaymentId !== null ||
      attempt.paymentLinkId !== null
  );

  if (touched) {
    return { cancelled: false, order };
  }

  const [cancelled] = await db
    .update(orders)
    .set({ orderStatus: "cancelled" })
    .where(eq(orders.id, order.id))
    .returning();

  await recordAudit({
    action: "ORDER_CANCELLED",
    actorId: params.actorId,
    actorType:
      order.buyerType === "human" ? "human_buyer" : "external_ai_agent",
    explanation: `Checkout window closed without a payment; order ${order.id} cancelled`,
    merchantId: order.merchantId,
    metadata: { totalPaise: order.totalAmount },
    orderId: order.id,
  });

  await recordFailure({
    errorMessage: "Buyer closed the checkout window without paying",
    errorType: "CHECKOUT_ABANDONED",
    orderId: order.id,
    recoveryAction: "CANCELLED_BY_BUYER",
  });

  return { cancelled: true, order: cancelled ?? order };
}

/** Full order view: line items plus every payment attempt. */
export async function getOrderSummary(orderId: string) {
  const order = await getOrderOrThrow(orderId);

  const [items, paymentRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)),
  ]);

  return { items, order, payments: paymentRows };
}
