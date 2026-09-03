/**
 * The catalogue query the shop page runs.
 *
 * Shaped like the endpoint that will replace it: filters in, a page of items
 * plus the facet counts and totals needed to render the sheet without a second
 * round trip. Facet counts are computed against the *other* filters, not the
 * filtered result, so a facet never shows zero for something you could
 * actually still choose.
 */

import type { CategorySlug } from "@workspace/db/taxonomy";
import { MOCK_PRODUCTS } from "./products";
import type { ProductSummary, StockState } from "./types";

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
};

export interface CatalogQuery {
  brands?: string[];
  category?: CategorySlug;
  compatibleOnly?: boolean;
  inStockOnly?: boolean;
  /** Rupees, as they appear in the URL. */
  maxRupees?: number;
  minRupees?: number;
  query?: string;
  sort?: ProductSort;
  /** Entries shaped "Label:Value". Same label ORs, different labels AND. */
  specs?: string[];
  take?: number;
}

export interface Facet {
  count: number;
  value: string;
}

export interface CatalogPage {
  brands: Facet[];
  /** How many of the unfiltered category the build filter would leave. */
  buildCompatible: number;
  items: ProductSummary[];
  /** The widest price in the category, in rupees, for the slider's ends. */
  priceCeilingRupees: number;
  priceFloorRupees: number;
  specs: { label: string; values: Facet[] }[];
  total: number;
}

/**
 * The build the shopper has open.
 *
 * A real build lives in the cart; here it is a fixed set of slots, so the
 * "compatible with my build" filter has something honest to filter against
 * rather than a random subset.
 */
export const MOCK_BUILD = {
  name: "VOLT, in progress",
  /* An AM5 board is already chosen, so LGA parts cannot join it. */
  slots: [
    "cpu",
    "motherboard",
    "ram",
    "gpu",
    "storage",
    "psu",
    "case",
    "cooler",
  ],
};

const INCOMPATIBLE_WITH_BUILD = new Set(["cpu-3", "gpu-4"]);

/** Whether a part could join the open build at all. */
function fitsBuild(product: ProductSummary) {
  return (
    MOCK_BUILD.slots.includes(product.category) &&
    !INCOMPATIBLE_WITH_BUILD.has(product.id) &&
    product.stock !== "out_of_stock"
  );
}

function matchesQuery(product: ProductSummary, query: string) {
  return `${product.brand} ${product.name} ${product.category}`
    .toLowerCase()
    .includes(query);
}

function byPrice(product: ProductSummary, min?: number, max?: number) {
  const rupees = product.pricePaise / 100;

  return (
    (min === undefined || rupees >= min) && (max === undefined || rupees <= max)
  );
}

function count<T>(values: T[], key: (value: T) => string): Facet[] {
  const tally = new Map<string, number>();

  for (const value of values) {
    const label = key(value);

    tally.set(label, (tally.get(label) ?? 0) + 1);
  }

  return [...tally.entries()]
    .map(([value, total]) => ({ count: total, value }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Selected values of one spec label widen the result; selected labels narrow
 * it. Picking two memory sizes means "either", picking a memory size and a
 * socket means "both" — which is what a shopper means by it.
 */
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

function sortItems(items: ProductSummary[], sort: ProductSort) {
  if (sort === "price_asc") {
    return [...items].sort((a, b) => a.pricePaise - b.pricePaise);
  }

  if (sort === "price_desc") {
    return [...items].sort((a, b) => b.pricePaise - a.pricePaise);
  }

  /* "Newest" is a claim about the catalogue's order, so it reverses it. */
  return [...items].reverse();
}

export function queryCatalog(options: CatalogQuery): CatalogPage {
  const inCategory = MOCK_PRODUCTS.filter(
    (product) => !options.category || product.category === options.category
  );

  const query = options.query?.trim().toLowerCase();

  const filtered = inCategory.filter((product) => {
    if (query && !matchesQuery(product, query)) {
      return false;
    }

    if (options.inStockOnly && product.stock !== ("in_stock" as StockState)) {
      return false;
    }

    if (options.compatibleOnly && !fitsBuild(product)) {
      return false;
    }

    if (!byPrice(product, options.minRupees, options.maxRupees)) {
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
  const prices = inCategory.map((product) => product.pricePaise / 100);

  const specLabels = [
    ...new Set(inCategory.flatMap((p) => p.keySpecs.map((s) => s.label))),
  ];

  return {
    brands: count(inCategory, (product) => product.brand),
    buildCompatible: inCategory.filter(fitsBuild).length,
    items: options.take ? sorted.slice(0, options.take) : sorted,
    priceCeilingRupees: prices.length
      ? Math.ceil(Math.max(...prices) / 1000) * 1000
      : 0,
    /* Seeding Math.min with 0 would peg every floor at zero. */
    priceFloorRupees: prices.length
      ? Math.floor(Math.min(...prices) / 1000) * 1000
      : 0,
    specs: specLabels.map((label) => ({
      label,
      values: count(
        inCategory.filter((p) => p.keySpecs.some((s) => s.label === label)),
        (product) =>
          product.keySpecs.find((spec) => spec.label === label)?.value ?? ""
      ),
    })),
    total: sorted.length,
  };
}
