/**
 * The mock API.
 *
 * Every screen in this build reads from here rather than from the database,
 * so a page can be designed and judged before its query exists. The functions
 * are shaped like the real endpoints and resolve after 300ms, which means the
 * loading states we build are real loading states rather than decoration.
 *
 * Handoff: replace these bodies with fetches. No component changes.
 */

import {
  CATEGORY_DEFINITIONS,
  type CategorySlug,
} from "@workspace/db/taxonomy";
import { MOCK_ACCOUNT } from "./account";
import { type CatalogPage, type CatalogQuery, queryCatalog } from "./catalog";
import { managerSummaryFor } from "./manager";
import {
  MANAGER_ORDERS,
  MANAGER_PRODUCTS,
  RESTOCK_DRAFTS,
  RESTOCK_ROWS,
  STORE_SETTINGS,
} from "./manager-tables";
import { MOCK_PREBUILTS, MOCK_PREBUILTS_BY_SLUG } from "./prebuilts";
import { checkAgainstBuild } from "./product-checks";
import { MOCK_PRODUCTS, MOCK_PRODUCTS_BY_ID } from "./products";
import type {
  Account,
  Cart,
  CartLine,
  ManagerOrder,
  ManagerProduct,
  ManagerSummary,
  PrebuiltDetail,
  PrebuiltSummary,
  ProductDetail,
  ProductSummary,
  RestockDraft,
  RestockRow,
  SearchOverlayData,
  StoreSettings,
} from "./types";

const LATENCY_MS = 300;

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), LATENCY_MS);
  });
}

export function getProducts(options?: {
  category?: CategorySlug;
  limit?: number;
}): Promise<ProductSummary[]> {
  const filtered = options?.category
    ? MOCK_PRODUCTS.filter((product) => product.category === options.category)
    : MOCK_PRODUCTS;

  return settle(options?.limit ? filtered.slice(0, options.limit) : filtered);
}

/**
 * Deterministic per-product reviews.
 *
 * Derived from the id rather than random, so the same product always shows the
 * same numbers and a screenshot taken twice matches.
 */
function reviewsFor(id: string) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distribution = [1, 2, 4, 12, 26].map(
    (base, index) => base + ((seed + index * 7) % 9)
  );
  const total = distribution.reduce((sum, count) => sum + count, 0);
  const average =
    distribution.reduce((sum, count, index) => sum + count * (index + 1), 0) /
    total;

  return {
    average: Math.round(average * 10) / 10,
    distribution,
    items: [
      {
        author: "Rohit M.",
        body: "Arrived in two days, packed properly. Runs quiet under load and the compatibility check saved me from a supply that was too small.",
        id: `${id}-r1`,
        rating: 5,
        when: "3 weeks ago",
      },
      {
        author: "Ananya S.",
        body: "Does what it says. Wish the bundled cable were longer, but no complaints about the part itself.",
        id: `${id}-r2`,
        rating: 4,
        when: "2 months ago",
      },
    ],
    total,
  };
}

export function getProduct(id: string): Promise<ProductDetail | null> {
  const product = MOCK_PRODUCTS_BY_ID.get(id);

  if (!product) {
    return settle(null);
  }

  const alternatives = MOCK_PRODUCTS.filter(
    (candidate) =>
      candidate.category === product.category && candidate.id !== product.id
  ).slice(0, 4);

  return settle({
    ...product,
    alternatives,
    compatibility: checkAgainstBuild(product),
    description: `${product.name} from ${product.brand}. ${product.keySpecs
      .map((spec) => `${spec.label.toLowerCase()} ${spec.value}`)
      .join(", ")}. Held in stock in Bengaluru and dispatched the same day.`,
    /* Placeholder identifiers standing in for image URLs, distinct as real
       ones would be. */
    images: ["front", "angle", "ports", "scale"].map(
      (view) => product.imageUrl || `${product.id}-${view}`
    ),
    reviews: reviewsFor(product.id),
    sku: `NX-${product.id.toUpperCase()}`,
    specGroups: [
      { rows: product.keySpecs, title: "At a glance" },
      {
        rows: [
          { label: "Warranty", value: "3 years" },
          { label: "Dispatch", value: "Same day" },
          { label: "Returns", value: "7 days" },
        ],
        title: "Ownership",
      },
    ],
  });
}

/** The shop page's one request: a page of items plus everything the sheet needs. */
export function getCatalog(options: CatalogQuery): Promise<CatalogPage> {
  return settle(queryCatalog(options));
}

export function getPrebuilts(): Promise<PrebuiltSummary[]> {
  return settle(MOCK_PREBUILTS);
}

export function getPrebuilt(slug: string): Promise<PrebuiltDetail | null> {
  return settle(MOCK_PREBUILTS_BY_SLUG.get(slug) ?? null);
}

export function getCart(): Promise<Cart> {
  const line = (id: string, quantity: number, buildId?: string): CartLine => {
    const product = MOCK_PRODUCTS_BY_ID.get(id);

    if (!product) {
      throw new Error(`Mock cart references an unknown product: ${id}`);
    }

    return { buildId, product, quantity };
  };

  const lines: CartLine[] = [
    line("cpu-1", 1, "build-volt"),
    line("motherboard-2", 1, "build-volt"),
    line("ram-1", 1, "build-volt"),
    line("gpu-1", 1, "build-volt"),
    line("psu-1", 1, "build-volt"),
    {
      ...line("gpu-3", 2),
      /* The fixture has this card on low stock, so the issue is real. */
      issue: {
        message: "Only 2 left — quantity reduced from 3.",
        state: "needs_verification",
      },
    },
    line("peripheral-1", 1),
  ];

  const subtotalPaise = lines.reduce(
    (total, entry) => total + entry.product.pricePaise * entry.quantity,
    0
  );
  const discountPaise = 500_000;
  const shippingPaise = 0;
  const taxPaise = Math.round((subtotalPaise - discountPaise) * 0.18);

  return settle({
    builds: [
      {
        id: "build-volt",
        name: "VOLT, in progress",
        requiredSlots: ["cpu", "motherboard", "ram", "storage", "psu", "case"],
      },
    ],
    discountPaise,
    lines,
    shippingPaise,
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise + taxPaise,
  });
}

export function searchIdle(): Promise<SearchOverlayData["idle"]> {
  const categories = CATEGORY_DEFINITIONS.map((definition) => ({
    count: MOCK_PRODUCTS.filter(
      (product) => product.category === definition.slug
    ).length,
    label: definition.name,
    slug: definition.slug,
  })).filter((category) => category.count > 0);

  /* The latest is a fact about the catalogue order: the four most recent. */
  return settle({ categories, latest: MOCK_PRODUCTS.slice(-4).reverse() });
}

export function searchQuery(
  term: string
): Promise<SearchOverlayData["typing"]> {
  const needle = term.trim().toLowerCase();

  if (!needle) {
    return settle({ capped: false, products: [], suggestions: [], total: 0 });
  }

  const matches = MOCK_PRODUCTS.filter((product) =>
    `${product.brand} ${product.name} ${product.category}`
      .toLowerCase()
      .includes(needle)
  );

  const suggestions = Array.from(
    new Set(matches.map((product) => product.brand))
  ).slice(0, 4);

  return settle({
    capped: matches.length > 6,
    products: matches.slice(0, 6),
    suggestions,
    total: matches.length,
  });
}

export function getManagerSummary(rangeId?: string): Promise<ManagerSummary> {
  return settle(managerSummaryFor(rangeId));
}

/** The signed-in shopper. One person, because this is a mock. */
export function getAccount(): Promise<Account> {
  return settle(MOCK_ACCOUNT);
}

export { MOCK_ACCOUNT } from "./account";
/* The manager's editing surfaces. Reads only — nothing here writes. */

export function getManagerProducts(): Promise<ManagerProduct[]> {
  return settle(MANAGER_PRODUCTS);
}

export function getManagerOrders(): Promise<ManagerOrder[]> {
  return settle(MANAGER_ORDERS);
}

export function getRestock(): Promise<{
  drafts: RestockDraft[];
  rows: RestockRow[];
}> {
  return settle({ drafts: RESTOCK_DRAFTS, rows: RESTOCK_ROWS });
}

export function getStoreSettings(): Promise<StoreSettings> {
  return settle(STORE_SETTINGS);
}

export type { CatalogPage, CatalogQuery, Facet, ProductSort } from "./catalog";
export { MOCK_BUILD, PRODUCT_SORTS, SORT_LABELS } from "./catalog";
export { MANAGER_RANGES } from "./manager";
export { MOCK_PREBUILTS } from "./prebuilts";
export { MOCK_PRODUCTS } from "./products";
export { MOCK_COMPATIBILITY, MOCK_FINDINGS } from "./reports";
export type * from "./types";
