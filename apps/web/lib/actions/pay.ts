"use server";

import { db, orders } from "@workspace/db";
import { type CheckoutHandoff, getMerchantGateway } from "@workspace/payments";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Paying an order that already exists.
 *
 * A buyer who closed the payment window, or whose agent order has since been
 * approved, needs a way back to the same Razorpay order rather than a second
 * one. The handoff is rebuilt from the stored `razorpay_order_id` and the
 * merchant's own key id — no new order, no new amount.
 *
 * The order is re-read under the buyer's own identifier, and an unapproved one
 * is refused here as well as by the gateway: an approval the merchant has not
 * given is not a payment this can start.
 */

const schema = z.object({
  orderId: z.uuid(),
  slug: z.string().min(1),
});

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
