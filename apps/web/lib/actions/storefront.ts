"use server";

import { loadBuildComponents } from "@workspace/commerce/builds";
import {
  addToCart,
  CartError,
  getOrCreateOpenCart,
  removeFromCart,
} from "@workspace/commerce/carts";
import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { validateBuild } from "@workspace/commerce/compatibility";
import { cartItems, db } from "@workspace/db";
import {
  BuildIncompatibleError,
  type CheckoutHandoff,
  createCheckoutOrder,
  createCheckoutOrderFromCart,
  PaymentError,
} from "@workspace/payments";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { openCartId } from "@/lib/data/cart";
import { isUuid } from "@/lib/data/product";
import { requireDefaultStore } from "@/lib/data/store";
import { currentBuyer, rememberGuest } from "@/lib/store/buyer";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Mutations for the unslugged storefront.
 *
 * Every one of these validates with `safeParse` and refuses with a sentence
 * rather than throwing. A thrown action reaches the browser as a 500 and an
 * opaque digest, which tells the shopper nothing and the log almost as
 * little; `ActionResult` is the shape the rest of `lib/actions` already uses
 * for exactly this reason.
 *
 * `lib/actions/cart.ts` does the same work for `/store/[slug]`, and takes the
 * slug from the form because that surface is multi-tenant by construction.
 * These take no slug at all: the store is whichever one `lib/data/store.ts`
 * resolves, so nothing a client posts can move the basket to another shop.
 *
 * The buyer is the session or the guest cookie, never the request body, and
 * the commerce package owns quantity clamping, line merging and build
 * grouping — duplicating any of that here would be a second set of rules to
 * keep in step with the first.
 */

const PATHS = ["/", "/cart", "/checkout", "/account"] as const;

function revalidateStore() {
  for (const path of PATHS) {
    revalidatePath(path);
  }
}

async function owner() {
  const merchant = await requireDefaultStore();
  const buyer = await currentBuyer();

  if (buyer.isGuest) {
    await rememberGuest(buyer.identifier);
  }

  return {
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
    userId: buyer.userId,
  };
}

const lineSchema = z.object({
  buildId: z.uuid().optional(),
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

export async function addToCartAction(
  input: z.input<typeof lineSchema>
): Promise<ActionResult> {
  const check = lineSchema.safeParse(input);

  if (!check.success) {
    return failed("That is not something this store sells.");
  }

  const parsed = check.data;

  try {
    await addToCart(await owner(), {
      buildId: parsed.buildId ?? null,
      productId: parsed.productId,
      quantity: parsed.quantity,
    });
  } catch (error) {
    return failed(
      error instanceof CartError
        ? error.message
        : "Could not add that to the cart."
    );
  }

  revalidateStore();

  return ok();
}

const quantitySchema = z.object({
  buildId: z.uuid().optional(),
  productId: z.uuid(),
  /** Zero removes the line, which is what the row's Remove does. */
  quantity: z.coerce.number().int().min(0).max(10),
});

/**
 * Sets a line to an absolute quantity.
 *
 * The commerce package deals in deltas — add three, remove one — because that
 * is what a conversation with an agent produces. A stepper produces a number,
 * so the difference is taken here rather than asking every caller to compute
 * one and risking two of them disagreeing about the direction.
 */
export async function setCartQuantityAction(
  input: z.input<typeof quantitySchema>
): Promise<ActionResult> {
  const check = quantitySchema.safeParse(input);

  if (!check.success) {
    return failed("That line could not be updated.");
  }

  const parsed = check.data;
  const scope = await owner();

  try {
    const cart = await getOrCreateOpenCart(scope);
    const buildId = parsed.buildId ?? null;

    const [existing] = await db
      .select({ quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, parsed.productId),
          buildId === null
            ? isNull(cartItems.buildId)
            : eq(cartItems.buildId, buildId)
        )
      )
      .limit(1);

    const current = existing?.quantity ?? 0;
    const delta = parsed.quantity - current;

    if (delta === 0) {
      return ok();
    }

    if (delta > 0) {
      await addToCart(scope, {
        buildId,
        productId: parsed.productId,
        quantity: delta,
      });
    } else {
      await removeFromCart(scope, {
        buildId,
        productId: parsed.productId,
        quantity: -delta,
      });
    }
  } catch (error) {
    return failed(
      error instanceof CartError ? error.message : "Could not update the cart."
    );
  }

  revalidateStore();

  return ok();
}

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

/**
 * Turns the open cart into an order.
 *
 * Everything that matters happens in `createCheckoutOrderFromCart`: the builds
 * in the cart are re-validated against the cart's own lines, the price is
 * re-derived from live product rows, and the Razorpay order is created. A
 * blocked checkout comes back as a value rather than an exception, because it
 * is a fact the shopper needs stated.
 */
export async function checkoutCartAction(): Promise<
  ActionResult<CheckoutStarted> | CheckoutBlocked
> {
  const scope = await owner();
  const cartId = await openCartId();

  if (!cartId) {
    return failed("Your cart is empty.");
  }

  try {
    const result = await createCheckoutOrderFromCart({
      buyerIdentifier: scope.buyerIdentifier,
      buyerType: "human",
      cartId,
      merchantId: scope.merchantId,
      userId: scope.userId,
    });

    revalidateStore();

    return ok({
      checkout: result.checkout,
      orderId: result.order.id,
      totalPaise: result.order.totalAmount,
      warnings: result.warnings,
    });
  } catch (error) {
    return toCheckoutFailure(error);
  }
}

const partsSchema = z.array(z.string()).max(24);

/**
 * Checkout for a selection the assistant assembled, rather than the cart.
 *
 * The parts are validated as a build before an order exists, for the same
 * reason the cart path is: §4's guarantee has to be a property of every route
 * to the money, not of the one the shopper happened to take. Nothing is added
 * to the cart on the way — arriving here from the build sheet and finding the
 * basket rearranged would be the app doing something nobody asked for.
 */
export async function checkoutPartsAction(
  productIds: string[]
): Promise<ActionResult<CheckoutStarted> | CheckoutBlocked> {
  const check = partsSchema.safeParse(productIds);
  const wanted = check.success ? check.data.filter(isUuid) : [];

  if (wanted.length === 0) {
    return failed("That build has no parts in it.");
  }

  const scope = await owner();

  try {
    const components = await loadBuildComponents(
      scope.merchantId,
      wanted.map((productId) => ({ productId, quantity: 1 }))
    );

    const validation = validateBuild(components);
    const blocking = validation.issues.filter(
      (issue) => issue.severity === "blocking"
    );

    if (blocking.length > 0) {
      throw new BuildIncompatibleError(blocking);
    }

    const result = await createCheckoutOrder({
      buyerIdentifier: scope.buyerIdentifier,
      buyerType: "human",
      items: wanted.map((productId) => ({ productId, quantity: 1 })),
      merchantId: scope.merchantId,
      userId: scope.userId,
    });

    revalidateStore();

    return ok({
      checkout: result.checkout,
      orderId: result.order.id,
      totalPaise: result.order.totalAmount,
      warnings: validation.issues.filter(
        (issue) => issue.severity === "warning"
      ),
    });
  } catch (error) {
    return toCheckoutFailure(error);
  }
}

function toCheckoutFailure(
  error: unknown
): ActionResult<CheckoutStarted> | CheckoutBlocked {
  if (error instanceof BuildIncompatibleError) {
    return { issues: error.issues, message: error.message, ok: false };
  }

  return failed(
    error instanceof PaymentError
      ? error.message
      : "Checkout could not be started. Nothing has been charged."
  );
}
