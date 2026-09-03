"use server";

import {
  addBuildToCart,
  addToCart,
  CartError,
  removeFromCart,
} from "@workspace/commerce/carts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentBuyer, rememberGuest } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Cart mutations.
 *
 * The merchant is resolved from the slug and the buyer from the session or the
 * guest cookie — neither is ever read from the form, so a posted id cannot
 * move somebody else's basket. Beyond that these are thin: `@workspace/commerce`
 * owns quantity clamping, line merging and the build grouping, and duplicating
 * any of it here would be a second set of rules to keep in step.
 */

const addSchema = z.object({
  buildId: z.uuid().optional(),
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  slug: z.string().min(1),
});

const removeSchema = z.object({
  buildId: z.uuid().optional(),
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).optional(),
  slug: z.string().min(1),
});

const buildSchema = z.object({
  buildId: z.uuid(),
  slug: z.string().min(1),
});

async function scopeFor(slug: string) {
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();

  if (buyer.isGuest) {
    await rememberGuest(buyer.identifier);
  }

  return {
    owner: {
      buyerIdentifier: buyer.identifier,
      merchantId: merchant.id,
      userId: buyer.userId,
    },
  };
}

function revalidateStore(slug: string) {
  revalidatePath(`/store/${slug}`, "layout");
}

export async function addToCartAction(
  input: z.input<typeof addSchema>
): Promise<ActionResult> {
  const check = addSchema.safeParse(input);

  if (!check.success) {
    return failed("That is not something this store sells.");
  }

  const parsed = check.data;
  const { owner } = await scopeFor(parsed.slug);

  try {
    await addToCart(owner, {
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

  revalidateStore(parsed.slug);

  return ok();
}

export async function removeFromCartAction(
  input: z.input<typeof removeSchema>
): Promise<ActionResult> {
  const check = removeSchema.safeParse(input);

  if (!check.success) {
    return failed("That line could not be updated.");
  }

  const parsed = check.data;
  const { owner } = await scopeFor(parsed.slug);

  try {
    await removeFromCart(owner, {
      buildId: parsed.buildId ?? null,
      productId: parsed.productId,
      quantity: parsed.quantity,
    });
  } catch (error) {
    return failed(
      error instanceof CartError ? error.message : "Could not update the cart."
    );
  }

  revalidateStore(parsed.slug);

  return ok();
}

/** Puts every part of a build into the basket as one group. */
export async function addBuildToCartAction(
  input: z.input<typeof buildSchema>
): Promise<ActionResult> {
  const check = buildSchema.safeParse(input);

  if (!check.success) {
    return failed("That build could not be added to the cart.");
  }

  const parsed = check.data;
  const { owner } = await scopeFor(parsed.slug);

  try {
    await addBuildToCart(owner, { buildId: parsed.buildId });
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : "Could not add the build."
    );
  }

  revalidateStore(parsed.slug);

  return ok();
}
