import { db, type Product, products } from "@workspace/db";
import { embed } from "ai";
import {
  and,
  cosineDistance,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  embeddingModel,
  embeddingProviderOptions,
  hasModelCredentials,
} from "./provider";

/**
 * Product retrieval for the shopping agent, and the machine-readable catalog
 * for external AI buyers.
 *
 * Search runs semantically over `products.embedding` when embeddings exist and
 * a provider key is configured, and falls back to a lexical match otherwise.
 * The fallback is not a degraded mode we tolerate — it is the guarantee that
 * the demo works with an unembedded catalog or an offline provider.
 */

export interface ProductSearchInput {
  budgetMaxPaise?: number;
  category?: string;
  inStockOnly?: boolean;
  limit?: number;
  query: string;
}

export interface ScoredProduct {
  product: Product;
  /** 0–1, higher is a better match. Lexical hits report a flat 0.5. */
  score: number;
}

export interface ProductSearchResult {
  products: ScoredProduct[];
  /** Which retrieval path answered, so the agent can be honest about it. */
  strategy: "semantic" | "lexical";
}

const WHITESPACE = /\s+/;
const NON_ALPHANUMERIC = /[^a-z0-9]/gi;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

function baseFilters(merchantId: string, input: ProductSearchInput) {
  const filters = [
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
  ];

  if (input.category) {
    filters.push(ilike(products.category, input.category));
  }

  if (typeof input.budgetMaxPaise === "number") {
    filters.push(lte(products.price, input.budgetMaxPaise));
  }

  if (input.inStockOnly !== false) {
    filters.push(gt(products.stock, 0));
  }

  return filters;
}

async function semanticSearch(
  merchantId: string,
  input: ProductSearchInput,
  limit: number
): Promise<ScoredProduct[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    providerOptions: embeddingProviderOptions(),
    value: input.query,
  });

  const similarity = sql<number>`1 - (${cosineDistance(products.embedding, embedding)})`;

  const rows = await db
    .select({ product: products, score: similarity })
    .from(products)
    .where(
      and(
        ...baseFilters(merchantId, input),
        sql`${products.embedding} is not null`
      )
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.map((row) => ({
    product: row.product,
    score: Number(row.score),
  }));
}

async function lexicalSearch(
  merchantId: string,
  input: ProductSearchInput,
  limit: number
): Promise<ScoredProduct[]> {
  const terms = input.query
    .toLowerCase()
    .split(WHITESPACE)
    .map((term) => term.replace(NON_ALPHANUMERIC, ""))
    .filter((term) => term.length > 2)
    .slice(0, 6);

  const matchers = terms.flatMap((term) => [
    ilike(products.name, `%${term}%`),
    ilike(products.description, `%${term}%`),
    ilike(products.brand, `%${term}%`),
    ilike(products.category, `%${term}%`),
  ]);

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        ...baseFilters(merchantId, input),
        matchers.length > 0 ? or(...matchers) : undefined
      )
    )
    .orderBy(desc(products.stock))
    .limit(limit);

  return rows.map((product) => ({ product, score: 0.5 }));
}

/**
 * Semantic first, lexical as the safety net.
 *
 * A semantic search that errors (no provider key, rate limit) or returns
 * nothing falls through rather than failing the turn.
 */
export async function searchCatalog(
  merchantId: string,
  input: ProductSearchInput
): Promise<ProductSearchResult> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  if (hasModelCredentials()) {
    try {
      const semantic = await semanticSearch(merchantId, input, limit);

      if (semantic.length > 0) {
        return { products: semantic, strategy: "semantic" };
      }
    } catch (error) {
      console.error("Semantic search failed, falling back to lexical", error);
    }
  }

  return {
    products: await lexicalSearch(merchantId, input, limit),
    strategy: "lexical",
  };
}

export async function getProductById(
  merchantId: string,
  productId: string
): Promise<Product | undefined> {
  return await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.merchantId, merchantId)),
  });
}

/** Batched lookup keyed by id, so a tool never issues one query per item. */
export async function getProductsByIds(
  merchantId: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const unique = [...new Set(productIds)];

  if (unique.length === 0) {
    return new Map();
  }

  const rows = await db
    .select()
    .from(products)
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, unique))
    );

  return new Map(rows.map((row) => [row.id, row]));
}

export async function listActiveProducts(
  merchantId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  return await db
    .select()
    .from(products)
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    )
    .orderBy(desc(products.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
}

/**
 * One catalog entry as an AI buyer sees it.
 *
 * Amounts are exposed as explicit paise integers with the currency alongside,
 * so no consumer has to guess at a unit or parse a formatted string.
 */
export interface CatalogEntry {
  attributes: Record<string, unknown> | null;
  brand: string | null;
  category: string | null;
  currency: string;
  description: string | null;
  id: string;
  image_url: string | null;
  in_stock: boolean;
  name: string;
  price_paise: number;
  sku: string | null;
  stock: number;
}

export function toCatalogEntry(
  product: Product,
  currency: string
): CatalogEntry {
  return {
    attributes: product.attributes ?? null,
    brand: product.brand,
    category: product.category,
    currency,
    description: product.description,
    id: product.id,
    image_url: product.imageUrl,
    in_stock: product.stock > 0,
    name: product.name,
    price_paise: product.price,
    sku: product.sku,
    stock: product.stock,
  };
}

/** Compact shape handed to the model — no embeddings, no timestamps. */
export function toModelProduct(product: Product) {
  return {
    brand: product.brand,
    category: product.category,
    description: product.description?.slice(0, 400) ?? null,
    id: product.id,
    imageUrl: product.imageUrl,
    inStock: product.stock > 0,
    name: product.name,
    pricePaise: product.price,
    stock: product.stock,
  };
}
