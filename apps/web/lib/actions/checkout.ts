"use server";

import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import {
  BuildIncompatibleError,
  type CheckoutHandoff,
  createCheckoutOrderFromCart,
  PaymentError,
} from "@workspace/payments";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentBuyer, rememberGuest } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Turning the cart into an order.
 *
 * Everything that matters happens in `createCheckoutOrderFromCart`: the builds
 * in the cart are re-validated against the cart's own lines, the price is
 * re-derived from live product rows, and the Razorpay order is created. This
 * only supplies the buyer, and refuses politely when the engine blocks — a
 * blocked checkout is a fact the shopper needs stated, not an exception.
 */

const checkoutSchema = z.object({
  cartId: z.uuid(),
  slug: z.string().min(1),
});

export interface CheckoutStarted {
  checkout: CheckoutHandoff | null;
  orderId: string;
  totalPaise: number;
  warnings: CompatibilityIssue[];
}

export interface CheckoutBlocked {
  issues: CompatibilityIssue[];
  message: string;
  ok: false;
}

export async function startCheckoutAction(
  input: z.input<typeof checkoutSchema>
): Promise<ActionResult<CheckoutStarted> | CheckoutBlocked> {
  const check = checkoutSchema.safeParse(input);

  if (!check.success) {
    return failed("Checkout could not be started. Nothing has been charged.");
  }

  const parsed = check.data;
  const merchant = await requireStore(parsed.slug);
  const buyer = await currentBuyer();

  if (buyer.isGuest) {
    await rememberGuest(buyer.identifier);
  }

  try {
    const result = await createCheckoutOrderFromCart({
      buyerIdentifier: buyer.identifier,
      buyerType: "human",
      cartId: parsed.cartId,
      merchantId: merchant.id,
      userId: buyer.userId,
    });

    revalidatePath(`/store/${parsed.slug}`, "layout");

    return ok({
      checkout: result.checkout,
      orderId: result.order.id,
      totalPaise: result.order.totalAmount,
      warnings: result.warnings,
    });
  } catch (error) {
    if (error instanceof BuildIncompatibleError) {
      return { issues: error.issues, message: error.message, ok: false };
    }

    return failed(
      error instanceof PaymentError
        ? error.message
        : "Checkout could not be started. Nothing has been charged."
    );
  }
}

const verifySchema = z.object({
  orderId: z.uuid(),
  slug: z.string().min(1),
});

/** Refreshes the pages that show order state once a payment settles. */
export async function refreshAfterPaymentAction(
  input: z.input<typeof verifySchema>
): Promise<ActionResult> {
  const check = verifySchema.safeParse(input);

  if (!check.success) {
    return failed("Those pages could not be refreshed.");
  }

  const parsed = check.data;

  revalidatePath(`/store/${parsed.slug}`, "layout");
  revalidatePath(`/store/${parsed.slug}/orders/${parsed.orderId}`);

  return ok();
}
