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
  hasEmbeddingCredentials,
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
  /** 0–1, higher is a better match. Lexical hits cap below semantic ones. */
  score: number;
}

export interface ProductSearchResult {
  products: ScoredProduct[];
  /** Which retrieval path answered, so the agent can be honest about it. */
  strategy: "semantic" | "lexical";
}

const WHITESPACE = /\s+/;
const NON_ALPHANUMERIC = /[^a-z0-9]/gi;

/**
 * Words long enough to survive the length filter but carrying no signal about
 * a product. Without this, "a graphics card **for** 1440p gaming" matches every
 * description containing "performance", and the query's real terms are
 * outvoted by its filler.
 */
const STOP_WORDS = new Set([
  "and",
  "any",
  "are",
  "best",
  "but",
  "can",
  "for",
  "get",
  "good",
  "has",
  "have",
  "its",
  "need",
  "not",
  "one",
  "that",
  "the",
  "them",
  "they",
  "this",
  "under",
  "want",
  "what",
  "which",
  "with",
  "you",
  "your",
]);

/**
 * What buyers call a category, mapped to what the catalogue calls it.
 *
 * `products.category` holds trade abbreviations — `gpu`, `psu`, `ram` — and
 * nobody shopping types those. Semantic search bridges the gap on its own;
 * lexical search cannot, so "a graphics card for 1440p gaming" matched every
 * motherboard with "Gaming" in its name and not one GPU. Recognising the
 * phrase and searching the category it names is the whole fix.
 *
 * Longest phrases first: "hard drive" must be tested before "drive".
 */
const CATEGORY_SYNONYMS: [phrase: string, category: string][] = [
  ["graphics card", "gpu"],
  ["video card", "gpu"],
  ["power supply", "psu"],
  ["hard drive", "storage"],
  ["solid state", "storage"],
  ["cpu cooler", "cooler"],
  ["heat sink", "cooler"],
  ["mother board", "motherboard"],
  ["processor", "cpu"],
  ["memory", "ram"],
  ["ssd", "storage"],
  ["hdd", "storage"],
  ["nvme", "storage"],
  ["screen", "monitor"],
  ["display", "monitor"],
  ["keyboard", "peripheral"],
  ["mouse", "peripheral"],
  ["headset", "peripheral"],
];

/**
 * Resolves whatever the model called a category to what the column stores.
 *
 * The `category` filter is an equality match, so an unrecognised value returns
 * nothing at all rather than a worse ranking. A model asked for "a graphics
 * card" naturally filters on `"Graphics Card"`, matches zero rows against
 * `gpu`, and — having been told to search before recommending — searches again
 * and again until it runs out of steps. Mapping the label is what stops that.
 *
 * An unrecognised value is passed through untouched: a merchant whose
 * categories are not the ones below must still be able to filter on their own.
 */
export function canonicalCategory(category: string): string {
  const needle = category.trim().toLowerCase();

  const match = CATEGORY_SYNONYMS.find(
    ([phrase, canonical]) => needle === phrase || needle === canonical
  );

  return match ? match[1] : needle;
}

/**
 * How much a match in each column counts toward the lexical score.
 *
 * A term in the name is strong evidence the row is what was asked for; the
 * same term in a description is weak — nearly every product description
 * mentions "gaming". Weighting them equally is what let a mouse outrank a
 * graphics card on the query "graphics card for 1440p gaming".
 */
const FIELD_WEIGHTS = [
  // Category outranks name: a term that matches a category is almost always
  // one the buyer named on purpose ("graphics card"), whereas a term matching
  // a name is often incidental — half the motherboards are called "Gaming".
  { column: products.category, weight: 5 },
  { column: products.name, weight: 4 },
  { column: products.brand, weight: 2 },
  { column: products.description, weight: 1 },
] as const;

/** The score one term can earn, used to normalise into the 0–1 contract. */
const MAX_SCORE_PER_TERM = FIELD_WEIGHTS.reduce(
  (total, field) => total + field.weight,
  0
);

/**
 * Lexical confidence is capped below a good semantic hit on purpose.
 *
 * A keyword match is genuinely weaker evidence than a vector match, and the
 * agent is told to be honest about confidence. Reporting a perfect 1.0 for
 * "the name contains every word you typed" would invite it to present a
 * keyword coincidence as a considered recommendation.
 */
const MAX_LEXICAL_SCORE = 0.6;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

function baseFilters(merchantId: string, input: ProductSearchInput) {
  const filters = [
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
  ];

  if (input.category) {
    filters.push(ilike(products.category, canonicalCategory(input.category)));
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
    // No retries: the caller already has a lexical fallback, so a rate-limited
    // or unreachable embedding provider should fail through to it at once.
    // The SDK default backs off for tens of seconds first, which turns a
    // degraded search into a stalled turn — and on an exhausted key, every
    // single search pays that before returning the same rows anyway.
    maxRetries: 0,
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
  const query = input.query.toLowerCase();

  const spoken = query
    .split(WHITESPACE)
    .map((term) => term.replace(NON_ALPHANUMERIC, ""))
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  // A named category is the strongest signal in the query, so it leads the
  // terms — the six-term cap must never drop it in favour of filler.
  const named = CATEGORY_SYNONYMS.filter(([phrase]) =>
    query.includes(phrase)
  ).map(([, category]) => category);

  const terms = [...new Set([...named, ...spoken])].slice(0, 6);

  const matchers = terms.flatMap((term) =>
    FIELD_WEIGHTS.map((field) => ilike(field.column, `%${term}%`))
  );

  /**
   * Relevance, as the number of weighted column hits across every term.
   *
   * Ranking used to be `stock desc`, which is a warehouse fact rather than a
   * relevance one: a well-stocked case whose description says "gaming" beat
   * the graphics card the buyer asked for. Stock survives only as the
   * tiebreaker it always should have been.
   */
  const relevance = terms.length
    ? sql<number>`(${sql.join(
        terms.flatMap((term) =>
          FIELD_WEIGHTS.map(
            (field) =>
              sql`(case when ${ilike(field.column, `%${term}%`)} then ${field.weight} else 0 end)`
          )
        ),
        sql` + `
      )})`
    : sql<number>`0`;

  const rows = await db
    .select({ product: products, score: relevance })
    .from(products)
    .where(
      and(
        ...baseFilters(merchantId, input),
        matchers.length > 0 ? or(...matchers) : undefined
      )
    )
    .orderBy(desc(relevance), desc(products.stock))
    .limit(limit);

  const ceiling = Math.max(terms.length, 1) * MAX_SCORE_PER_TERM;

  return rows.map((row) => ({
    product: row.product,
    score: Math.min(
      MAX_LEXICAL_SCORE,
      (Number(row.score) / ceiling) * MAX_LEXICAL_SCORE
    ),
  }));
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

  if (hasEmbeddingCredentials()) {
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
