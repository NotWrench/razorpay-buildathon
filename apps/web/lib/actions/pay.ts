"use server";

import { db, orders } from "@workspace/db";
import {
  abandonCheckout,
  type CheckoutHandoff,
  getMerchantGateway,
} from "@workspace/payments";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Paying an order that already exists.
 *
 * A buyer whose card was declined, or whose agent order has since been
 * approved, needs a way back to the same Razorpay order rather than a second
 * one. The handoff is rebuilt from the stored `razorpay_order_id` and the
 * merchant's own key id — no new order, no new amount.
 *
 * A window closed without a payment is not one of those cases any more: that
 * order is cancelled by `abandonPaymentAction` below, and a cancelled order is
 * refused here.
 *
 * The order is re-read under the buyer's own identifier, and an unapproved one
 * is refused here as well as by the gateway: an approval the merchant has not
 * given is not a payment this can start.
 */

const schema = z.object({
  orderId: z.uuid(),
  slug: z.string().min(1),
});

const abandonSchema = z.object({ orderId: z.uuid() });

export async function resumePaymentAction(
  input: z.input<typeof schema>
): Promise<ActionResult<CheckoutHandoff>> {
  const check = schema.safeParse(input);

  if (!check.success) {
    return failed("That order could not be found.");
  }

  const parsed = check.data;
  const merchant = await requireStore(parsed.slug);
  const buyer = await currentBuyer();

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, parsed.orderId),
      eq(orders.merchantId, merchant.id),
      eq(orders.buyerIdentifier, buyer.identifier)
    ),
  });

  if (!order) {
    return failed("That order could not be found.");
  }

  if (order.approvalStatus !== "approved") {
    return failed("This order is still waiting for the merchant's approval.");
  }

  if (order.orderStatus === "paid") {
    return failed("This order is already paid.");
  }

  if (order.orderStatus === "cancelled") {
    return failed("This order was cancelled. Order again to buy it.");
  }

  if (!order.razorpayOrderId) {
    return failed("No payment has been set up for this order yet.");
  }

  const { credentials } = await getMerchantGateway(merchant.id);

  return ok({
    amount: order.totalAmount,
    currency: order.currency,
    keyId: credentials.keyId,
    razorpayOrderId: order.razorpayOrderId,
  });
}

/**
 * Closing the payment window without paying.
 *
 * The buyer's own answer, recorded where the merchant reads it: an order left
 * at `created` looks like a sale still in progress, and until now nothing ever
 * told it apart from a window the buyer walked away from.
 *
 * The order is re-read under the buyer's identifier first, so this cancels
 * only the caller's own order. Whether it is cancellable at all is decided
 * server-side by `abandonCheckout` — a payment that reached the gateway is
 * left alone, so a dismiss firing just after a successful payment cannot undo
 * it.
 */
export async function abandonPaymentAction(
  input: z.input<typeof abandonSchema>
): Promise<ActionResult<{ cancelled: boolean }>> {
  const check = abandonSchema.safeParse(input);

  if (!check.success) {
    return failed("That order could not be found.");
  }

  const buyer = await currentBuyer();

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, check.data.orderId),
      eq(orders.buyerIdentifier, buyer.identifier)
    ),
  });

  if (!order) {
    return failed("That order could not be found.");
  }

  const result = await abandonCheckout({
    actorId: buyer.identifier,
    orderId: order.id,
  });

  return ok({ cancelled: result.cancelled });
}
