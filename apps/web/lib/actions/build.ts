"use server";

import {
  BuildError,
  createBuild,
  deleteBuild,
  getBuildOrThrow,
  updateBuild,
  validateBuildById,
} from "@workspace/commerce/builds";
import { db, products } from "@workspace/db";
import { getCategoryDefinition } from "@workspace/db/taxonomy";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentBuyer, rememberGuest } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";
import type { ActionResult } from "./result";
import { failed, ok } from "./result";

/**
 * Editing a build.
 *
 * A slot edit is expressed as "the build now holds this set of parts" rather
 * than as a patch, because that is the only shape `updateBuild` accepts — and
 * the reason it does is that every edit has to re-run the engine and drop the
 * build back to `draft`. Nothing here decides whether a build is valid; the
 * page reads that back from the engine after the write.
 */

const slotSchema = z.object({
  buildId: z.uuid().optional(),
  productId: z.uuid(),
  slug: z.string().min(1),
});

const itemSchema = z.object({
  buildId: z.uuid(),
  productId: z.uuid(),
  slug: z.string().min(1),
});

const buildOnlySchema = z.object({
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
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
    userId: buyer.userId,
  };
}

function revalidateBuild(slug: string) {
  revalidatePath(`/store/${slug}`, "layout");
}

/**
 * Puts a part in its slot.
 *
 * How the existing parts are treated comes from the taxonomy, not from the
 * caller: a slot that holds one part (a CPU, a case) is replaced, and a slot
 * that holds several (storage, fans) is added to up to its maximum. Hard-coding
 * either behaviour here would put a second copy of `maxPerBuild` in the app.
 */
export async function setBuildPartAction(
  input: z.input<typeof slotSchema>
): Promise<ActionResult<{ buildId: string }>> {
  const check = slotSchema.safeParse(input);

  if (!check.success) {
    return failed("That part could not be placed in the build.");
  }

  const parsed = check.data;
  const scope = await scopeFor(parsed.slug);

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, parsed.productId),
      eq(products.merchantId, scope.merchantId),
      eq(products.isActive, true)
    ),
  });

  if (!(product && product.category)) {
    return failed("That part is not available in this store.");
  }

  const definition = getCategoryDefinition(product.category);
  const capacity = definition?.maxPerBuild ?? 1;

  try {
    if (!parsed.buildId) {
      const { build } = await createBuild({
        ...scope,
        items: [{ productId: product.id, quantity: 1 }],
        name: "My build",
      });

      revalidateBuild(parsed.slug);

      return ok({ buildId: build.id });
    }

    const existing = await getBuildOrThrow({
      buildId: parsed.buildId,
      buyerIdentifier: scope.buyerIdentifier,
      merchantId: scope.merchantId,
    });

    const sameSlot = existing.items.filter(
      (item) => item.categorySlug === product.category
    );

    const kept =
      capacity <= 1
        ? existing.items.filter(
            (item) => item.categorySlug !== product.category
          )
        : existing.items;

    if (capacity > 1 && sameSlot.length >= capacity) {
      return failed(
        `This build already holds ${capacity} ${definition?.name ?? product.category}.`
      );
    }

    await updateBuild({
      buildId: parsed.buildId,
      buyerIdentifier: scope.buyerIdentifier,
      items: [
        ...kept.map((item) => ({
          isPrimary: item.isPrimary,
          productId: item.productId,
          quantity: item.quantity,
        })),
        { productId: product.id, quantity: 1 },
      ],
      merchantId: scope.merchantId,
    });

    revalidateBuild(parsed.slug);

    return ok({ buildId: parsed.buildId });
  } catch (error) {
    return failed(
      error instanceof BuildError
        ? error.message
        : "Could not update the build."
    );
  }
}

export async function removeBuildPartAction(
  input: z.input<typeof itemSchema>
): Promise<ActionResult> {
  const check = itemSchema.safeParse(input);

  if (!check.success) {
    return failed("That part could not be removed from the build.");
  }

  const parsed = check.data;
  const scope = await scopeFor(parsed.slug);

  try {
    const existing = await getBuildOrThrow({
      buildId: parsed.buildId,
      buyerIdentifier: scope.buyerIdentifier,
      merchantId: scope.merchantId,
    });

    await updateBuild({
      buildId: parsed.buildId,
      buyerIdentifier: scope.buyerIdentifier,
      items: existing.items
        .filter((item) => item.productId !== parsed.productId)
        .map((item) => ({
          isPrimary: item.isPrimary,
          productId: item.productId,
          quantity: item.quantity,
        })),
      merchantId: scope.merchantId,
    });
  } catch (error) {
    return failed(
      error instanceof BuildError
        ? error.message
        : "Could not update the build."
    );
  }

  revalidateBuild(parsed.slug);

  return ok();
}

/** Re-runs the engine and writes the result back onto the build. */
export async function validateBuildAction(
  input: z.input<typeof buildOnlySchema>
): Promise<ActionResult<{ canCheckout: boolean }>> {
  const check = buildOnlySchema.safeParse(input);

  if (!check.success) {
    return failed("That build could not be checked.");
  }

  const parsed = check.data;
  const scope = await scopeFor(parsed.slug);

  try {
    const { validation } = await validateBuildById({
      buildId: parsed.buildId,
      buyerIdentifier: scope.buyerIdentifier,
      merchantId: scope.merchantId,
    });

    revalidateBuild(parsed.slug);

    return ok({ canCheckout: validation.canCheckout });
  } catch (error) {
    return failed(
      error instanceof BuildError ? error.message : "Could not check the build."
    );
  }
}

const seedSchema = z.object({
  name: z.string().min(1).max(80).default("My build"),
  productIds: z.array(z.uuid()).min(1).max(24),
  slug: z.string().min(1),
});

/**
 * A build that starts life as somebody else's parts list.
 *
 * This is what "Configure" on a pre-built machine means: the manifest becomes
 * a draft the shopper owns and can change, rather than a fixed SKU. It is one
 * `createBuild` rather than a loop of `setBuildPartAction`, so the engine runs
 * once over the finished set instead of firing completeness warnings at every
 * intermediate state.
 */
export async function startBuildFromPartsAction(
  input: z.input<typeof seedSchema>
): Promise<ActionResult<{ buildId: string }>> {
  const check = seedSchema.safeParse(input);

  if (!check.success) {
    return failed("That configuration could not be opened.");
  }

  const parsed = check.data;
  const scope = await scopeFor(parsed.slug);

  const available = await db.query.products.findMany({
    where: and(
      eq(products.merchantId, scope.merchantId),
      eq(products.isActive, true),
      inArray(products.id, parsed.productIds)
    ),
  });

  if (available.length === 0) {
    return failed("None of those parts are available in this store.");
  }

  try {
    const { build } = await createBuild({
      ...scope,
      items: available.map((product) => ({
        productId: product.id,
        quantity: 1,
      })),
      name: parsed.name,
    });

    revalidateBuild(parsed.slug);

    return ok({ buildId: build.id });
  } catch (error) {
    return failed(
      error instanceof BuildError
        ? error.message
        : "Could not open that configuration."
    );
  }
}

const startSchema = z.object({
  name: z.string().min(1).max(80).default("My build"),
  slug: z.string().min(1),
});

export async function startBuildAction(
  input: z.input<typeof startSchema>
): Promise<ActionResult<{ buildId: string }>> {
  const check = startSchema.safeParse(input);

  if (!check.success) {
    return failed("That build could not be started.");
  }

  const parsed = check.data;
  const scope = await scopeFor(parsed.slug);

  const { build } = await createBuild({
    ...scope,
    items: [],
    name: parsed.name,
  });

  revalidateBuild(parsed.slug);

  return ok({ buildId: build.id });
}

/**
 * Removes a saved build.
 *
 * The account page listed builds with no way to remove one, so the list only
 * ever grew. Ownership is checked inside `deleteBuild`'s `where`, so a build id
 * belonging to somebody else deletes nothing and reads back as not found.
 */
export async function deleteBuildAction(
  input: z.input<typeof buildOnlySchema>
): Promise<ActionResult> {
  const check = buildOnlySchema.safeParse(input);

  if (!check.success) {
    return failed("That build could not be removed.");
  }

  const scope = await scopeFor(check.data.slug);
  const removed = await deleteBuild({
    buildId: check.data.buildId,
    buyerIdentifier: scope.buyerIdentifier,
    merchantId: scope.merchantId,
  });

  if (!removed) {
    return failed("That build could not be found.");
  }

  revalidateBuild(check.data.slug);
  revalidatePath("/account");

  return ok();
}
