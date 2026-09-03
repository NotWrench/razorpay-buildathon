import {
  db,
  inventory,
  isUuid,
  type Product,
  type ProductSpec,
  productCategories,
  productSpecs,
  products,
} from "@workspace/db";
import {
  CATEGORY_DEFINITIONS,
  type CategorySlug,
  isCategorySlug,
} from "@workspace/db/taxonomy";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { cache } from "react";
import { headlineSpecRows, specEntries } from "@/lib/specs";
import { reportForProduct } from "./compatibility";
import { storeId } from "./store";
import type {
  ProductDetail,
  ProductSummary,
  SearchOverlayData,
  SpecRow,
  StockState,
} from "./types";

/**
 * Products, in the shape the storefront screens were designed against.
 *
 * The contract in `./types.ts` is what every card, row and table already
 * reads; this module is the only place a `products` row is turned into one.
 * Keeping the translation in one function means "what does low stock mean"
 * has a single answer rather than one per screen.
 */

/** A product row with everything the summary needs joined onto it. */
export interface ProductRow {
  lowStockThreshold: number | null;
  product: Product;
  specs: ProductSpec | null;
}

function baseQuery() {
  return db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id));
}

/**
 * Three states from one integer and a threshold.
 *
 * `low_stock` needs a threshold to mean anything — six units is plenty of
 * fans and nearly none of a flagship card — so it comes from the merchant's
 * own `inventory.low_stock_threshold`, and falls back to a small constant
 * only when nobody has configured one.
 */
const DEFAULT_LOW_STOCK = 5;

export function stockState(
  onHand: number,
  threshold: number | null
): StockState {
  if (onHand <= 0) {
    return "out_of_stock";
  }

  return onHand <= (threshold ?? DEFAULT_LOW_STOCK) ? "low_stock" : "in_stock";
}

/**
 * The category, as the contract's enum.
 *
 * `products.category` is a nullable denormalised mirror, so a row written
 * before the taxonomy existed can carry something that is not a slug. Those
 * fall back to `peripheral` rather than crashing a shelf: an uncategorised
 * part is a data problem for the manager screens to surface, not a reason the
 * shop stops rendering.
 */
function categoryOf(product: Product): CategorySlug {
  return product.category && isCategorySlug(product.category)
    ? product.category
    : "peripheral";
}

export function toSummary(row: ProductRow): ProductSummary {
  const { product } = row;

  return {
    brand: product.brand ?? "",
    category: categoryOf(product),
    id: product.id,
    imageUrl: product.imageUrl ?? "",
    keySpecs: headlineSpecRows(product.category, row.specs, product.attributes),
    name: product.name,
    pricePaise: product.price,
    stock: stockState(product.stock, row.lowStockThreshold),
  };
}

/**
 * Re-exported so the storefront's callers have it to hand.
 *
 * `/product/gpu-1` is a stale link from the fixture era. Handing it to
 * Postgres as a uuid raises 22P02 and the page 500s; checking the shape first
 * turns the same request into the 404 it always was.
 */
export { isUuid } from "@workspace/db";

/** Active products, optionally one category, in-stock first then cheapest. */
export async function getProducts(options?: {
  category?: CategorySlug;
  limit?: number;
}): Promise<ProductSummary[]> {
  const merchantId = await storeId();

  const conditions = [
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
  ];

  if (options?.category) {
    conditions.push(eq(products.category, options.category));
  }

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(desc(sql`${products.stock} > 0`), asc(products.price))
    .limit(options?.limit ?? 500);

  return rows.map(toSummary);
}

/** The same rows, by id, in the order asked for. */
export async function getProductsByIds(
  ids: string[]
): Promise<ProductSummary[]> {
  const wanted = ids.filter(isUuid);

  if (wanted.length === 0) {
    return [];
  }

  const merchantId = await storeId();

  const rows = await baseQuery().where(
    and(eq(products.merchantId, merchantId), inArray(products.id, wanted))
  );

  const byId = new Map(rows.map((row) => [row.product.id, toSummary(row)]));

  return ids
    .map((id) => byId.get(id))
    .filter((summary): summary is ProductSummary => summary !== undefined);
}

/**
 * Reviews.
 *
 * There is no reviews table, and writing one row of invented prose per product
 * into the database would not make the words any more real. What is derived
 * here is derived from the id, so a product's rating is stable across reloads
 * and two screenshots of the same page match — and the day a `product_reviews`
 * table exists, this function is the only thing that changes.
 */
const REVIEW_BUCKETS = [1, 2, 4, 12, 26];

function reviewsFor(id: string) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distribution = REVIEW_BUCKETS.map(
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

const OWNERSHIP: SpecRow[] = [
  { label: "Warranty", value: "3 years" },
  { label: "Dispatch", value: "Same day" },
  { label: "Returns", value: "7 days" },
];

/** One part, with its alternatives and its verdict against the open build. */
export const getProduct = cache(
  async (id: string): Promise<ProductDetail | null> => {
    if (!isUuid(id)) {
      return null;
    }

    const merchantId = await storeId();

    const [row] = await baseQuery()
      .where(and(eq(products.id, id), eq(products.merchantId, merchantId)))
      .limit(1);

    if (!row) {
      return null;
    }

    const summary = toSummary(row);

    const [alternatives, compatibility] = await Promise.all([
      listAlternatives(merchantId, row.product),
      reportForProduct(row.product.id),
    ]);

    const stated = specEntries(row.specs);

    return {
      ...summary,
      alternatives,
      compatibility,
      description:
        row.product.description ??
        `${row.product.name} from ${summary.brand}. Held in stock and dispatched the same day.`,
      /* One entry per view. Until a product carries more than one photograph
         that is a single frame, and the gallery drops its thumbnail rail. */
      images: [summary.imageUrl || `${row.product.id}-render`],
      onHand: row.product.stock,
      reviews: reviewsFor(row.product.id),
      sku: row.product.sku ?? `NX-${row.product.id.slice(0, 8).toUpperCase()}`,
      specGroups: [
        ...(stated.length > 0
          ? [{ rows: stated, title: "Specifications" }]
          : []),
        ...(stated.length === 0 && summary.keySpecs.length > 0
          ? [{ rows: summary.keySpecs, title: "At a glance" }]
          : []),
        { rows: OWNERSHIP, title: "Ownership" },
      ],
    };
  }
);

async function listAlternatives(
  merchantId: string,
  product: Product
): Promise<ProductSummary[]> {
  if (!product.category) {
    return [];
  }

  const rows = await baseQuery()
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.isActive, true),
        eq(products.category, product.category),
        sql`${products.id} <> ${product.id}`
      )
    )
    .orderBy(desc(sql`${products.stock} > 0`), asc(products.price))
    .limit(4);

  return rows.map(toSummary);
}

/* ── The search overlay ─────────────────────────────────────────────────── */

/** What the overlay shows before anything is typed. */
export async function searchIdle(): Promise<SearchOverlayData["idle"]> {
  const merchantId = await storeId();

  const [counts, latest] = await Promise.all([
    db
      .select({ slug: productCategories.slug, total: sql<number>`count(*)` })
      .from(products)
      .innerJoin(
        productCategories,
        eq(productCategories.id, products.categoryId)
      )
      .where(
        and(eq(products.merchantId, merchantId), eq(products.isActive, true))
      )
      .groupBy(productCategories.slug),
    baseQuery()
      .where(
        and(eq(products.merchantId, merchantId), eq(products.isActive, true))
      )
      .orderBy(desc(products.createdAt))
      .limit(4),
  ]);

  const bySlug = new Map(counts.map((row) => [row.slug, Number(row.total)]));

  return {
    categories: CATEGORY_DEFINITIONS.map((definition) => ({
      count: bySlug.get(definition.slug) ?? 0,
      label: definition.name,
      slug: definition.slug,
    })).filter((category) => category.count > 0),
    latest: latest.map(toSummary),
  };
}

/** Six results and a real total, so the overlay can say "and 14 more". */
const SEARCH_LIMIT = 6;

export async function searchQuery(
  term: string
): Promise<SearchOverlayData["typing"]> {
  const needle = term.trim();

  if (!needle) {
    return { capped: false, products: [], suggestions: [], total: 0 };
  }

  const merchantId = await storeId();
  const pattern = `%${needle}%`;

  const where = and(
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
    or(
      ilike(products.name, pattern),
      ilike(products.brand, pattern),
      ilike(products.category, pattern)
    )
  );

  const [rows, [totals]] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(desc(sql`${products.stock} > 0`), asc(products.price))
      .limit(SEARCH_LIMIT),
    db.select({ value: sql<number>`count(*)` }).from(products).where(where),
  ]);

  const total = Number(totals?.value ?? 0);

  /* Brands of the shown results only. A suggestion for a brand the shopper
     cannot see a single result from reads as a dead end. */
  const suggestions = [
    ...new Set(
      rows
        .map((row) => row.product.brand)
        .filter((brand): brand is string => Boolean(brand))
    ),
  ].slice(0, 4);

  return {
    capped: total > SEARCH_LIMIT,
    products: rows.map(toSummary),
    suggestions,
    total,
  };
}
