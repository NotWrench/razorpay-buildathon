import {
  type BuildValidation,
  validateBuild,
} from "@workspace/commerce/compatibility";
import {
  type Build,
  buildItems,
  builds,
  db,
  type Product,
  type ProductSpec,
  productSpecs,
  products,
} from "@workspace/db";
import type { CategorySlug } from "@workspace/db/taxonomy";
import { and, desc, eq } from "drizzle-orm";

/**
 * The build a page renders.
 *
 * `@workspace/commerce` owns the rules and the writes; this only reads a build
 * back with enough product detail to draw it — a name, a price and an image
 * per slot. Validation is the engine's, never re-derived here: a second
 * implementation of the compatibility rules in the UI is exactly the drift §4
 * warns about.
 */

export interface BuildSlotEntry {
  categorySlug: CategorySlug;
  isPrimary: boolean;
  product: Product;
  quantity: number;
  specs: ProductSpec | null;
}

export interface BuildView {
  build: Build;
  entries: BuildSlotEntry[];
  subtotalPaise: number;
  validation: BuildValidation;
}

/** The buyer's most recent build that has not become an order. */
export async function getLatestBuild(params: {
  buyerIdentifier: string;
  merchantId: string;
}): Promise<Build | null> {
  const build = await db.query.builds.findFirst({
    orderBy: desc(builds.updatedAt),
    where: and(
      eq(builds.merchantId, params.merchantId),
      eq(builds.buyerIdentifier, params.buyerIdentifier)
    ),
  });

  return build && build.status !== "ordered" ? build : null;
}

export async function listBuildsForBuyer(params: {
  buyerIdentifier: string;
  merchantId: string;
}): Promise<Build[]> {
  return await db.query.builds.findMany({
    orderBy: desc(builds.updatedAt),
    where: and(
      eq(builds.merchantId, params.merchantId),
      eq(builds.buyerIdentifier, params.buyerIdentifier)
    ),
  });
}

/** A build with its parts, its price and the engine's verdict. */
export async function loadBuildView(params: {
  buildId: string;
  buyerIdentifier: string;
  merchantId: string;
}): Promise<BuildView | null> {
  const build = await db.query.builds.findFirst({
    where: and(
      eq(builds.id, params.buildId),
      eq(builds.merchantId, params.merchantId),
      eq(builds.buyerIdentifier, params.buyerIdentifier)
    ),
  });

  if (!build) {
    return null;
  }

  const rows = await db
    .select({
      categorySlug: buildItems.categorySlug,
      isPrimary: buildItems.isPrimary,
      product: products,
      quantity: buildItems.quantity,
      specs: productSpecs,
    })
    .from(buildItems)
    .innerJoin(products, eq(products.id, buildItems.productId))
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .where(eq(buildItems.buildId, build.id));

  const entries: BuildSlotEntry[] = rows.map((row) => ({
    categorySlug: row.categorySlug as CategorySlug,
    isPrimary: row.isPrimary,
    product: row.product,
    quantity: row.quantity,
    specs: row.specs,
  }));

  return {
    build,
    entries,
    subtotalPaise: entries.reduce(
      (sum, entry) => sum + entry.product.price * entry.quantity,
      0
    ),
    validation: validateBuild(
      entries.map((entry) => ({
        categorySlug: entry.categorySlug,
        name: entry.product.name,
        productId: entry.product.id,
        quantity: entry.quantity,
        specs: entry.specs,
      }))
    ),
  };
}
