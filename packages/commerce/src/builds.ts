import {
  buildItems,
  builds,
  db,
  productCategories,
  productSpecs,
  products,
} from "@workspace/db";
import type { CategorySlug } from "@workspace/db/taxonomy";
import { and, eq, inArray } from "drizzle-orm";
import type { BuildComponent, BuildValidation } from "./compatibility/index";
import { validateBuild } from "./compatibility/index";

/**
 * Builds, as rows.
 *
 * Everything here takes both a `merchantId` and a `buyerIdentifier` and
 * filters on both. Neither is ever accepted from a model — they come from the
 * server-resolved agent context — so a tool cannot read or edit a build
 * belonging to another shopper or another store however it is called.
 *
 * Unlike `./compatibility`, this module talks to the database. The rules stay
 * pure and testable without one; loading the rows they run on is a separate
 * job with a separate import path.
 */

export class BuildError extends Error {
  readonly code: "BUILD_NOT_FOUND" | "PRODUCT_NOT_FOUND" | "BUILD_INCOMPATIBLE";

  constructor(
    code: "BUILD_NOT_FOUND" | "PRODUCT_NOT_FOUND" | "BUILD_INCOMPATIBLE",
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "BuildError";
  }
}

export interface BuildSelection {
  isPrimary?: boolean;
  productId: string;
  quantity?: number;
}

/**
 * Turns product ids into the components the engine validates.
 *
 * The category comes from `product_categories` rather than the free-text
 * mirror on the product, and a product the merchant does not sell is an error
 * rather than an omission — silently dropping it would validate a build that
 * is not the one the buyer described.
 */
export async function loadBuildComponents(
  merchantId: string,
  selections: BuildSelection[]
): Promise<BuildComponent[]> {
  if (selections.length === 0) {
    return [];
  }

  const productIds = [...new Set(selections.map((item) => item.productId))];

  const rows = await db
    .select({
      categorySlug: productCategories.slug,
      name: products.name,
      productId: products.id,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, productIds))
    );

  const byId = new Map(rows.map((row) => [row.productId, row]));

  return selections.map((selection) => {
    const row = byId.get(selection.productId);

    if (!row) {
      throw new BuildError(
        "PRODUCT_NOT_FOUND",
        `Product ${selection.productId} is not available in this store`
      );
    }

    if (!row.categorySlug) {
      throw new BuildError(
        "PRODUCT_NOT_FOUND",
        `${row.name} has no category, so it cannot take a slot in a build`
      );
    }

    return {
      categorySlug: row.categorySlug as CategorySlug,
      name: row.name,
      productId: row.productId,
      quantity: selection.quantity ?? 1,
      specs: row.specs,
    };
  });
}

/** The build row plus its items, or an error the caller can surface. */
export async function getBuildOrThrow(params: {
  buildId: string;
  buyerIdentifier: string;
  merchantId: string;
}) {
  const build = await db.query.builds.findFirst({
    where: and(
      eq(builds.id, params.buildId),
      eq(builds.merchantId, params.merchantId),
      eq(builds.buyerIdentifier, params.buyerIdentifier)
    ),
    with: { items: true },
  });

  if (!build) {
    throw new BuildError(
      "BUILD_NOT_FOUND",
      `No build found for ${params.buildId}`
    );
  }

  return build;
}

export async function listBuilds(params: {
  buyerIdentifier: string;
  merchantId: string;
}) {
  return await db.query.builds.findMany({
    orderBy: (table, { desc }) => desc(table.updatedAt),
    where: and(
      eq(builds.merchantId, params.merchantId),
      eq(builds.buyerIdentifier, params.buyerIdentifier)
    ),
    with: { items: true },
  });
}

/**
 * Removes a build the buyer owns.
 *
 * Scoped in the `where` rather than fetched-then-checked, so a build id from
 * another buyer or another store deletes nothing and reports nothing found —
 * the caller cannot tell the two apart, which is the point.
 *
 * `build_items` has `onDelete: "cascade"`, so the parts go with it. Cart lines
 * do not: `cart_items.build_id` is `set null`, so a build already in the basket
 * survives as loose lines rather than emptying the basket underneath someone.
 */
export async function deleteBuild(params: {
  buildId: string;
  buyerIdentifier: string;
  merchantId: string;
}): Promise<boolean> {
  const removed = await db
    .delete(builds)
    .where(
      and(
        eq(builds.id, params.buildId),
        eq(builds.merchantId, params.merchantId),
        eq(builds.buyerIdentifier, params.buyerIdentifier)
      )
    )
    .returning({ id: builds.id });

  return removed.length > 0;
}

async function writeItems(buildId: string, components: BuildComponent[]) {
  await db.delete(buildItems).where(eq(buildItems.buildId, buildId));

  if (components.length === 0) {
    return;
  }

  await db.insert(buildItems).values(
    components.map((component, index) => ({
      buildId,
      categorySlug: component.categorySlug,
      // The first part in a slot is its primary one until something says
      // otherwise — with one drive selected, that drive is the boot drive.
      isPrimary:
        components.findIndex(
          (other) => other.categorySlug === component.categorySlug
        ) === index,
      productId: component.productId,
      quantity: component.quantity,
    }))
  );
}

export async function createBuild(params: {
  buyerIdentifier: string;
  conversationId?: string | null;
  items: BuildSelection[];
  merchantId: string;
  name: string;
  userId?: string | null;
}) {
  const components = await loadBuildComponents(params.merchantId, params.items);

  const [build] = await db
    .insert(builds)
    .values({
      buyerIdentifier: params.buyerIdentifier,
      conversationId: params.conversationId ?? null,
      merchantId: params.merchantId,
      name: params.name,
      userId: params.userId ?? null,
    })
    .returning();

  if (!build) {
    throw new BuildError("BUILD_NOT_FOUND", "Failed to create the build");
  }

  await writeItems(build.id, components);

  return { build, components };
}

/**
 * Replaces a build's parts.
 *
 * The status drops back to `draft` on every edit. `validated` is a claim about
 * a specific set of parts, and carrying it across a change would let a build
 * that has since had its case swapped still look approved — a stale pass is
 * worse than no pass.
 */
export async function updateBuild(params: {
  buildId: string;
  buyerIdentifier: string;
  items: BuildSelection[];
  merchantId: string;
  name?: string;
}) {
  await getBuildOrThrow(params);

  const components = await loadBuildComponents(params.merchantId, params.items);

  await writeItems(params.buildId, components);

  const [build] = await db
    .update(builds)
    .set({
      ...(params.name ? { name: params.name } : {}),
      status: "draft",
    })
    .where(eq(builds.id, params.buildId))
    .returning();

  if (!build) {
    throw new BuildError(
      "BUILD_NOT_FOUND",
      `No build found for ${params.buildId}`
    );
  }

  return { build, components };
}

export interface ValidatedBuild {
  build: Awaited<ReturnType<typeof getBuildOrThrow>>;
  components: BuildComponent[];
  validation: BuildValidation;
}

/**
 * Loads a build and runs the engine over it.
 *
 * A clean pass is written back as `validated`, and anything else returns the
 * build to `draft`. The stored status is therefore never ahead of the last
 * actual check.
 */
export async function validateBuildById(params: {
  buildId: string;
  buyerIdentifier: string;
  merchantId: string;
}): Promise<ValidatedBuild> {
  const build = await getBuildOrThrow(params);

  const components = await loadBuildComponents(
    params.merchantId,
    build.items.map((item) => ({
      isPrimary: item.isPrimary,
      productId: item.productId,
      quantity: item.quantity,
    }))
  );

  const validation = validateBuild(components);

  const status = validation.canCheckout ? "validated" : "draft";

  if (build.status !== "ordered" && build.status !== status) {
    await db.update(builds).set({ status }).where(eq(builds.id, build.id));
    build.status = status;
  }

  return { build, components, validation };
}
