"use server";

import { addresses, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentBuyer, rememberGuest } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * The address book.
 *
 * Same shape as `actions/build.ts`, and for the same reasons: every write is
 * scoped to a store and a buyer before it touches a row, nothing throws where a
 * shopper could have caused it, and the page re-reads from the server rather
 * than the client holding a second copy of the list.
 *
 * A guest gets an address book too. `rememberGuest` is what makes that stick
 * across a refresh, and it is the same call the cart and the build make.
 */

const PINCODE = /^\d{6}$/;
const trimmed = (max: number) => z.string().trim().min(1).max(max);

const addressSchema = z.object({
  /** Present when editing, absent when creating. */
  addressId: z.uuid().optional(),
  city: trimmed(80),
  label: trimmed(40),
  line1: trimmed(160),
  line2: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(20).optional(),
  pincode: z.string().trim().regex(PINCODE),
  primary: z.boolean().optional(),
  slug: z.string().min(1),
  state: trimmed(80),
});

const addressOnlySchema = z.object({
  addressId: z.uuid(),
  slug: z.string().min(1),
});

async function scopeFor(slug: string) {
  const merchant = await requireStore(slug);
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

/** Only rows this buyer owns, in this store. Every write goes through it. */
function owned(
  scope: { buyerIdentifier: string; merchantId: string },
  addressId: string
) {
  return and(
    eq(addresses.id, addressId),
    eq(addresses.merchantId, scope.merchantId),
    eq(addresses.buyerIdentifier, scope.buyerIdentifier)
  );
}

/**
 * Exactly one primary per buyer.
 *
 * Two statements, not a partial unique index: clearing the old default and
 * setting the new one cannot happen in one write, and an index would reject the
 * moment in between. The first address a buyer saves becomes the default
 * whether or not they asked, because an address book with no default is a
 * choice nobody made.
 */
async function clearPrimary(scope: {
  buyerIdentifier: string;
  merchantId: string;
}) {
  await db
    .update(addresses)
    .set({ primary: "no" })
    .where(
      and(
        eq(addresses.merchantId, scope.merchantId),
        eq(addresses.buyerIdentifier, scope.buyerIdentifier)
      )
    );
}

async function isFirst(scope: { buyerIdentifier: string; merchantId: string }) {
  const rows = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(
      and(
        eq(addresses.merchantId, scope.merchantId),
        eq(addresses.buyerIdentifier, scope.buyerIdentifier)
      )
    )
    .limit(1);

  return rows.length === 0;
}

/** Creates when `addressId` is absent, updates when it is present. */
export async function saveAddressAction(
  input: z.input<typeof addressSchema>
): Promise<ActionResult<{ addressId: string }>> {
  const check = addressSchema.safeParse(input);

  if (!check.success) {
    return failed(
      "That address is not complete. A six-digit PIN code and a street, city and state are needed."
    );
  }

  const { addressId, slug, primary, ...fields } = check.data;
  const scope = await scopeFor(slug);
  const first = addressId ? false : await isFirst(scope);
  const wantsPrimary = primary === true || first;

  if (wantsPrimary) {
    await clearPrimary(scope);
  }

  const values = {
    ...fields,
    line2: fields.line2 || null,
    phone: fields.phone || null,
    primary: wantsPrimary ? ("yes" as const) : ("no" as const),
  };

  if (addressId) {
    const updated = await db
      .update(addresses)
      .set(values)
      .where(owned(scope, addressId))
      .returning({ id: addresses.id });

    if (updated.length === 0) {
      return failed("That address could not be found.");
    }

    revalidatePath("/account");

    return ok({ addressId });
  }

  const [created] = await db
    .insert(addresses)
    .values({ ...values, ...scope })
    .returning({ id: addresses.id });

  if (!created) {
    return failed("That address could not be saved.");
  }

  revalidatePath("/account");

  return ok({ addressId: created.id });
}

export async function deleteAddressAction(
  input: z.input<typeof addressOnlySchema>
): Promise<ActionResult> {
  const check = addressOnlySchema.safeParse(input);

  if (!check.success) {
    return failed("That address could not be removed.");
  }

  const scope = await scopeFor(check.data.slug);
  const removed = await db
    .delete(addresses)
    .where(owned(scope, check.data.addressId))
    .returning({ primary: addresses.primary });

  if (removed.length === 0) {
    return failed("That address could not be found.");
  }

  /* Deleting the default leaves the book without one, so the next address
     inherits it. Newest, because that is the one most likely to be current. */
  if (removed[0]?.primary === "yes") {
    const [next] = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(
        and(
          eq(addresses.merchantId, scope.merchantId),
          eq(addresses.buyerIdentifier, scope.buyerIdentifier)
        )
      )
      .limit(1);

    if (next) {
      await db
        .update(addresses)
        .set({ primary: "yes" })
        .where(eq(addresses.id, next.id));
    }
  }

  revalidatePath("/account");

  return ok();
}

export async function setPrimaryAddressAction(
  input: z.input<typeof addressOnlySchema>
): Promise<ActionResult> {
  const check = addressOnlySchema.safeParse(input);

  if (!check.success) {
    return failed("That address could not be set as the default.");
  }

  const scope = await scopeFor(check.data.slug);
  await clearPrimary(scope);

  const updated = await db
    .update(addresses)
    .set({ primary: "yes" })
    .where(owned(scope, check.data.addressId))
    .returning({ id: addresses.id });

  if (updated.length === 0) {
    return failed("That address could not be found.");
  }

  revalidatePath("/account");

  return ok();
}
