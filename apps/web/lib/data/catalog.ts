import type { BuildComponent } from "@workspace/commerce/compatibility";
import {
  db,
  inventory,
  type Product,
  type ProductSpec,
  productSpecs,
  products,
} from "@workspace/db";
import { isCategorySlug } from "@workspace/db/taxonomy";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { fitsOpenBuild, openBuild } from "./compatibility";
import { toSummary } from "./product";
import { storeId } from "./store";
import type {
  CatalogPage,
  CatalogQuery,
  Facet,
  ProductSort,
  ProductSummary,
} from "./types";

export type {
  CatalogPage,
  CatalogQuery,
  Facet,
  ProductSort,
} from "./types";
export { PRODUCT_SORTS, SORT_LABELS } from "./types";

/**
 * The shop page's one request.
 *
 * Filters in; a page of items plus the facet counts and price bounds the
 * sheet needs, so opening the filters costs no round trip.
 *
 * The database scopes the query to the merchant, the category and the text
 * term, and everything after that — brand and spec facets, the price bounds,
 * the build filter — is computed over those rows in memory. That is a
 * deliberate limit, not an oversight: facets over free-form spec values and a
 * per-product compatibility verdict are not things SQL does cheaply, and a
 * category here is tens of rows. A catalogue two orders of magnitude larger
 * would need the facets denormalised into their own table; this one does not.
 */

const PRICE_STEP = 1000;

interface Row {
  lowStockThreshold: number | null;
  product: Product;
  specs: ProductSpec | null;
}

function matchesSpecs(product: ProductSummary, selected: string[]) {
  const byLabel = new Map<string, string[]>();

  for (const entry of selected) {
    const [label, ...rest] = entry.split(":");
    const value = rest.join(":");

    if (label && value) {
      byLabel.set(label, [...(byLabel.get(label) ?? []), value]);
    }
  }

  for (const [label, values] of byLabel) {
    const spec = product.keySpecs.find((row) => row.label === label);

    if (!(spec && values.includes(spec.value))) {
      return false;
    }
  }

  return true;
}

function tally<T>(values: T[], key: (value: T) => string): Facet[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const label = key(value);

    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ count, value }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function sortItems(items: ProductSummary[], sort: ProductSort) {
  if (sort === "price_asc") {
    return [...items].sort((a, b) => a.pricePaise - b.pricePaise);
  }

  if (sort === "price_desc") {
    return [...items].sort((a, b) => b.pricePaise - a.pricePaise);
  }

  /* The rows arrive newest-first from the database, so "newest" is the
     order they are already in. */
  return items;
}

function toComponent(row: Row): BuildComponent | null {
  if (!(row.product.category && isCategorySlug(row.product.category))) {
    return null;
  }

  return {
    categorySlug: row.product.category,
    name: row.product.name,
    productId: row.product.id,
    quantity: 1,
    specs: row.specs,
  };
}

export async function getCatalog(options: CatalogQuery): Promise<CatalogPage> {
  const merchantId = await storeId();

  const conditions = [
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
  ];

  if (options.category) {
    conditions.push(eq(products.category, options.category));
  }

  const term = options.query?.trim();

  if (term) {
    const pattern = `%${term}%`;
    const match = or(
      ilike(products.name, pattern),
      ilike(products.brand, pattern),
      ilike(products.category, pattern)
    );

    if (match) {
      conditions.push(match);
    }
  }

  const [rows, build] = await Promise.all([
    db
      .select({
        lowStockThreshold: inventory.lowStockThreshold,
        product: products,
        specs: productSpecs,
      })
      .from(products)
      .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(products.createdAt)),
    openBuild(),
  ]);

  const scoped = rows.map((row) => ({ row, summary: toSummary(row) }));

  /* Which of these could join the open build at all — the real engine, run
     over parts whose specs are already loaded. Without a build every part is
     equally admissible, which is what an empty set of slots means. */
  const compatible = new Set<string>();

  if (build) {
    for (const entry of scoped) {
      const component = toComponent(entry.row);

      if (component && fitsOpenBuild(build, component)) {
        compatible.add(entry.summary.id);
      }
    }
  }

  const filtered = scoped
    .map((entry) => entry.summary)
    .filter((product) => {
      if (options.inStockOnly && product.stock !== "in_stock") {
        return false;
      }

      if (options.compatibleOnly && !compatible.has(product.id)) {
        return false;
      }

      const rupees = product.pricePaise / 100;

      if (options.minRupees !== undefined && rupees < options.minRupees) {
        return false;
      }

      if (options.maxRupees !== undefined && rupees > options.maxRupees) {
        return false;
      }

      if (options.brands?.length && !options.brands.includes(product.brand)) {
        return false;
      }

      if (options.specs?.length && !matchesSpecs(product, options.specs)) {
        return false;
      }

      return true;
    });

  const sorted = sortItems(filtered, options.sort ?? "newest");
  const all = scoped.map((entry) => entry.summary);
  const prices = all.map((product) => product.pricePaise / 100);

  const specLabels = [
    ...new Set(all.flatMap((product) => product.keySpecs.map((s) => s.label))),
  ];

  return {
    brands: tally(all, (product) => product.brand),
    buildCompatible: build ? compatible.size : all.length,
    buildName: build?.name ?? null,
    items: options.take ? sorted.slice(0, options.take) : sorted,
    /* Seeding Math.min with 0 would peg every floor at zero. */
    priceCeilingRupees: prices.length
      ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP
      : 0,
    priceFloorRupees: prices.length
      ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP
      : 0,
    specs: specLabels.map((label) => ({
      label,
      values: tally(
        all.filter((product) =>
          product.keySpecs.some((spec) => spec.label === label)
        ),
        (product) =>
          product.keySpecs.find((spec) => spec.label === label)?.value ?? ""
      ),
    })),
    total: sorted.length,
  };
}
