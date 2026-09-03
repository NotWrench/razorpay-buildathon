import {
  db,
  isUuid,
  type Product,
  type ProductSpec,
  productCategories,
  productSpecs,
  products,
} from "@workspace/db";
import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { cache } from "react";

/**
 * Catalog reads for the storefront.
 *
 * The agent has its own retrieval path in `@workspace/ai` — semantic, scored,
 * and shaped for a model. A shelf is a different job: it filters, sorts and
 * pages deterministically, so a shopper who picks "GPU, under ₹40,000, in
 * stock" gets exactly that set every time they reload.
 */

export interface CatalogProduct extends Product {
  specs: ProductSpec | null;
}

export interface CategoryFacet {
  buildSlot: string | null;
  id: string;
  isBuildComponent: boolean;
  name: string;
  productCount: number;
  slug: string;
  sortOrder: number;
}

export const PRODUCT_SORTS = [
  "relevance",
  "price-asc",
  "price-desc",
  "newest",
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface CatalogFilters {
  category?: string;
  inStockOnly?: boolean;
  limit?: number;
  maxPricePaise?: number;
  minPricePaise?: number;
  offset?: number;
  query?: string;
  sort?: ProductSort;
}

/** Categories the store actually stocks, with how much is in each. */
export const listCategories = cache(
  async (merchantId: string): Promise<CategoryFacet[]> => {
    const rows = await db
      .select({
        buildSlot: productCategories.buildSlot,
        id: productCategories.id,
        isBuildComponent: productCategories.isBuildComponent,
        name: productCategories.name,
        productCount: count(products.id),
        slug: productCategories.slug,
        sortOrder: productCategories.sortOrder,
      })
      .from(productCategories)
      .leftJoin(
        products,
        and(
          eq(products.categoryId, productCategories.id),
          eq(products.isActive, true)
        )
      )
      .where(eq(productCategories.merchantId, merchantId))
      .groupBy(
        productCategories.id,
        productCategories.buildSlot,
        productCategories.isBuildComponent,
        productCategories.name,
        productCategories.slug,
        productCategories.sortOrder
      )
      .orderBy(asc(productCategories.sortOrder));

    return rows;
  }
);

function filterConditions(merchantId: string, filters: CatalogFilters) {
  const conditions = [
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
  ];

  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }

  if (filters.inStockOnly) {
    conditions.push(sql`${products.stock} > 0`);
  }

  if (filters.minPricePaise !== undefined) {
    conditions.push(gte(products.price, filters.minPricePaise));
  }

  if (filters.maxPricePaise !== undefined) {
    conditions.push(lte(products.price, filters.maxPricePaise));
  }

  if (filters.query) {
    const needle = `%${filters.query}%`;

    conditions.push(
      or(
        ilike(products.name, needle),
        ilike(products.brand, needle),
        ilike(products.description, needle)
      ) ?? sql`true`
    );
  }

  return and(...conditions);
}

function orderFor(sort: ProductSort | undefined) {
  switch (sort) {
    case "price-asc":
      return asc(products.price);
    case "price-desc":
      return desc(products.price);
    case "newest":
      return desc(products.createdAt);
    default:
      // In-stock first, then the cheapest — a shelf whose first row cannot be
      // bought reads as an empty shop.
      return [desc(sql`${products.stock} > 0`), asc(products.price)];
  }
}

export interface CatalogPage {
  products: CatalogProduct[];
  total: number;
}

/** One page of the shelf, with the spec row each card needs for its summary. */
export async function listCatalog(
  merchantId: string,
  filters: CatalogFilters = {}
): Promise<CatalogPage> {
  const where = filterConditions(merchantId, filters);
  const order = orderFor(filters.sort);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ product: products, specs: productSpecs })
      .from(products)
      .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
      .where(where)
      .orderBy(...(Array.isArray(order) ? order : [order]))
      .limit(filters.limit ?? 24)
      .offset(filters.offset ?? 0),
    db.select({ value: count() }).from(products).where(where),
  ]);

  return {
    products: rows.map((row) => ({ ...row.product, specs: row.specs })),
    total: totals?.value ?? 0,
  };
}

export const getCatalogProduct = cache(
  async (
    merchantId: string,
    productId: string
  ): Promise<CatalogProduct | null> => {
    /* A product id off a URL can be anything. Postgres rejects a malformed
       uuid with a driver error, so the shape is checked before the query and
       a bad one is simply not a product. */
    if (!isUuid(productId)) {
      return null;
    }

    const [row] = await db
      .select({ product: products, specs: productSpecs })
      .from(products)
      .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
      .where(
        and(eq(products.id, productId), eq(products.merchantId, merchantId))
      )
      .limit(1);

    return row ? { ...row.product, specs: row.specs } : null;
  }
);

/** Other parts in the same category, for the "alternatives" rail. */
export async function listAlternatives(
  merchantId: string,
  product: Product,
  limit = 4
): Promise<CatalogProduct[]> {
  if (!product.category) {
    return [];
  }

  const { products: rows } = await listCatalog(merchantId, {
    category: product.category,
    limit: limit + 1,
  });

  return rows.filter((row) => row.id !== product.id).slice(0, limit);
}

/** A few products per category, for the home page rails. */
export async function listFeaturedByCategory(
  merchantId: string,
  slugs: string[],
  perCategory = 4
): Promise<{ category: string; products: CatalogProduct[] }[]> {
  const pages = await Promise.all(
    slugs.map((slug) =>
      listCatalog(merchantId, {
        category: slug,
        inStockOnly: true,
        limit: perCategory,
      })
    )
  );

  return slugs
    .map((slug, index) => ({
      category: slug,
      products: pages[index]?.products ?? [],
    }))
    .filter((rail) => rail.products.length > 0);
}

/** The display name for a category slug, taxonomy first. */
export function categoryLabel(slug: string): string {
  const definition = CATEGORY_DEFINITIONS.find((entry) => entry.slug === slug);

  return definition?.name ?? slug.toUpperCase();
}
