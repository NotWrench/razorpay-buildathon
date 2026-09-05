import {
  db,
  type Product,
  productCategories,
  productSpecs,
  products,
} from "@workspace/db";
import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { embedQuery } from "./embeddings";
import { embeddingModelId } from "./provider";
import {
  canonicalCategory,
  namesOnlyACategory,
  queryTerms,
} from "./search-terms";

/**
 * Product retrieval for the shopping agent, and the machine-readable catalog
 * for external AI buyers.
 *
 * Search runs semantically over `products.embedding` when embeddings exist and
 * a provider key is configured, and falls back to a lexical match otherwise.
 * The fallback is not a degraded mode we tolerate — it is the guarantee that
 * the demo works with an unembedded catalog or an exhausted embedding quota.
 *
 * Both paths can return nothing, and that is a first-class answer rather than
 * a failure. A vector index always has a nearest neighbour, so a search for a
 * product the store does not sell will happily rank the whole catalog by how
 * little it resembles a laptop — see `SEMANTIC_MIN_LEAD` for what stops that.
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
  /** 0–1 confidence, higher is a better match. See `semanticConfidence`. */
  score: number;
}

export interface ProductSearchResult {
  products: ScoredProduct[];
  /**
   * Which retrieval path answered, so the agent can be honest about it.
   * `none` means both paths ran and neither found anything worth showing.
   */
  strategy: "semantic" | "lexical" | "none";
}

/** What a store stocks, for when a search finds nothing. */
export interface CatalogScope {
  categories: { category: string; count: number; fromPaise: number }[];
  cheapestPaise: number | null;
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

/**
 * How far the best semantic hit must stand out from the catalog's own median
 * similarity before the result set counts as a match at all.
 *
 * Cosine similarity from an embedding model is not an absolute scale, and the
 * band it uses is narrower than it looks. Measured against this store's
 * catalog (`bun run calibrate:search`), every query for something the store
 * sells produced a top hit between 0.61 and 0.70, and every query for
 * something it does not — a laptop, a printer, a washing machine — produced
 * one between 0.55 and 0.61. There is no threshold that separates those.
 *
 * What separates them is the *lead*: how far the best hit sits above the
 * median similarity across the whole catalog for that same query. When nothing
 * is relevant everything is equally irrelevant, so the whole catalog bunches
 * together and the best hit leads it by almost nothing. Absent products led by
 * 0.019 to 0.052. Real queries led by 0.072 to 0.125.
 *
 * The one measured exception is a bare plural category — "peripherals for my
 * pc" leads by 0.052, indistinguishable from a query for a laptop, because a
 * word like "peripherals" names a shelf rather than a thing and sits no closer
 * to a keyboard than to a case. That query is answered by the lexical path
 * instead, which recognises a category word exactly (see `queryTerms`). The
 * two paths cover each other: vectors read intent, keywords read labels.
 *
 * The number is a property of the embedding model, not of good taste. Re-run
 * the calibration after changing models, and override it with
 * `AI_SEARCH_MIN_LEAD` rather than editing this.
 */
const DEFAULT_MIN_LEAD = 0.065;

/** A lead this large is as confident as this scale gets. */
const STRONG_LEAD = 0.15;

/**
 * Where to cut the tail of a result set, as a fraction of the winning lead.
 *
 * The rows below this are what the vector index would have returned anyway —
 * ranked, but not actually about the query. Keeping them is how a motherboard
 * ends up in a list of graphics cards.
 */
const SEMANTIC_TAIL_FRACTION = 0.5;

/**
 * Below this many embedded products there is no distribution to measure, so
 * the lead test is skipped rather than guessed at.
 */
const MIN_BACKGROUND_ROWS = 8;

function minLead(): number {
  const configured = Number(process.env.AI_SEARCH_MIN_LEAD);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MIN_LEAD;
}

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

/**
 * Only rows written by the model that is embedding queries right now.
 *
 * Vectors from two models are incomparable, so comparing across them does not
 * return worse results — it returns arbitrary ones. After an embedding-model
 * change every row is stale, semantic search finds nothing, the lexical path
 * answers, and `bun run embed` puts it back. Degrading is the point.
 */
function currentEmbedding() {
  return and(
    isNotNull(products.embedding),
    eq(products.embeddingModel, embeddingModelId())
  );
}

/**
 * The median similarity between this query and everything the store sells.
 *
 * This is the baseline a real match has to beat. It is deliberately measured
 * against the whole active catalog rather than against the filtered result
 * set, so that "a graphics card under ₹5,000" is judged by whether the cheap
 * rows are actually graphics cards — not by whether one of them stands out
 * among the other cheap rows, which it always will.
 *
 * Undefined when there are too few embedded rows to have a distribution.
 */
async function backgroundSimilarity(
  merchantId: string,
  embedding: number[]
): Promise<number | undefined> {
  const [row] = await db
    .select({
      median: sql<
        number | null
      >`percentile_cont(0.5) within group (order by 1 - (${cosineDistance(products.embedding, embedding)}))`,
      rows: sql<number>`count(*)`,
    })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.isActive, true),
        currentEmbedding()
      )
    );

  if (!row || Number(row.rows) < MIN_BACKGROUND_ROWS || row.median === null) {
    return;
  }

  return Number(row.median);
}

/**
 * Turns a raw cosine score into something the agent can honestly quote.
 *
 * The raw number is close to useless as confidence: on this catalog a perfect
 * match scores 0.69 and a query for a product the store has never heard of
 * scores 0.60. What carries the signal is the distance above the background,
 * so that is what is reported — 0 when the hit is no better than average, 1
 * when it leads by `STRONG_LEAD`.
 */
function semanticConfidence(score: number, background: number): number {
  return Math.min(1, Math.max(0, (score - background) / STRONG_LEAD));
}

/**
 * Returns undefined when semantic search could not run at all (no provider
 * key, exhausted quota, nothing embedded yet), and an empty array when it ran
 * and found nothing convincing. The caller treats those differently.
 */
async function semanticSearch(
  merchantId: string,
  input: ProductSearchInput,
  limit: number
): Promise<ScoredProduct[] | undefined> {
  const embedding = await embedQuery(input.query);

  if (!embedding) {
    return;
  }

  const similarity = sql<number>`1 - (${cosineDistance(products.embedding, embedding)})`;

  const rows = await db
    .select({ product: products, score: similarity })
    .from(products)
    .where(and(...baseFilters(merchantId, input), currentEmbedding()))
    .orderBy(desc(similarity))
    .limit(limit);

  const [top] = rows;

  if (!top) {
    return [];
  }

  const background = await backgroundSimilarity(merchantId, embedding);

  if (background === undefined) {
    return rows.map((row) => ({
      product: row.product,
      score: Number(row.score),
    }));
  }

  const lead = Number(top.score) - background;

  // An explicit category filter is its own scope check: the buyer has already
  // said what kind of thing they want, and the filter either finds rows of
  // that kind or it does not. Applying the lead test on top would reject
  // "a quiet one" asked of a category the store demonstrably stocks.
  if (lead < minLead() && !input.category) {
    return [];
  }

  const cut = background + lead * SEMANTIC_TAIL_FRACTION;

  return rows
    .filter((row) => Number(row.score) >= cut)
    .map((row) => ({
      product: row.product,
      score: semanticConfidence(Number(row.score), background),
    }));
}

/**
 * Columns a match in which is evidence the row is the thing being asked for.
 *
 * A term found only in a description is not. Nearly every product description
 * in a PC catalog mentions gaming, performance and cooling, so a query with
 * one real noun and a few adjectives used to match the entire shelf — and the
 * ranking below would then dutifully sort the shelf. Requiring at least one
 * term in a category, name or brand is what makes "a laptop" return nothing
 * from a store that sells no laptops; descriptions still influence the order.
 */
const ANCHOR_FIELDS = FIELD_WEIGHTS.filter((field) => field.weight >= 2);

async function lexicalSearch(
  merchantId: string,
  input: ProductSearchInput,
  limit: number
): Promise<ScoredProduct[]> {
  const terms = queryTerms(input.query);

  // Nothing to match on. Returning every product ordered by stock — which is
  // what an unconstrained query used to do — is not a search result, it is a
  // shelf, and the agent would present it as one.
  if (terms.length === 0) {
    return [];
  }

  const anchors = terms.flatMap((term) =>
    ANCHOR_FIELDS.map((field) => ilike(field.column, `%${term}%`))
  );

  /**
   * Relevance, as the number of weighted column hits across every term.
   *
   * Ranking used to be `stock desc`, which is a warehouse fact rather than a
   * relevance one: a well-stocked case whose description says "gaming" beat
   * the graphics card the buyer asked for. Stock survives only as the
   * tiebreaker it always should have been.
   */
  const relevance = sql<number>`(${sql.join(
    terms.flatMap((term) =>
      FIELD_WEIGHTS.map(
        (field) =>
          sql`(case when ${ilike(field.column, `%${term}%`)} then ${field.weight} else 0 end)`
      )
    ),
    sql` + `
  )})`;

  const rows = await db
    .select({ product: products, score: relevance })
    .from(products)
    .where(and(...baseFilters(merchantId, input), or(...anchors)))
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
 * Semantic first, lexical as the safety net, and nothing at all as a real
 * answer.
 *
 * Semantic search that cannot run (no provider key, exhausted quota, an
 * unembedded catalog) falls through to lexical rather than failing the turn.
 * Semantic search that runs and rejects everything also falls through, because
 * an exact brand or model number is the one thing keyword matching does better
 * — but if that finds nothing either, the honest answer is that the store does
 * not sell this, and `strategy: "none"` is how the agent is told to say so
 * instead of presenting the nearest eight unrelated products.
 */
export async function searchCatalog(
  merchantId: string,
  input: ProductSearchInput
): Promise<ProductSearchResult> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  if (namesOnlyACategory(input.query)) {
    const named = await lexicalSearch(merchantId, input, limit);

    if (named.length > 0) {
      return { products: named, strategy: "lexical" };
    }
  }

  try {
    const semantic = await semanticSearch(merchantId, input, limit);

    if (semantic && semantic.length > 0) {
      return { products: semantic, strategy: "semantic" };
    }
  } catch (error) {
    console.error("Semantic search failed, falling back to lexical", error);
  }

  const lexical = await lexicalSearch(merchantId, input, limit);

  return {
    products: lexical,
    strategy: lexical.length > 0 ? "lexical" : "none",
  };
}

/**
 * What this store actually sells, for a search that found nothing.
 *
 * An empty result is only useful to the agent if it can say what the store
 * does stock instead — "we sell PC components, not laptops" is a helpful
 * answer and "I'm sorry, no results" is not. Grounded in the catalog like
 * every other claim: §19 does not stop applying because the answer is a
 * refusal.
 */
export async function describeCatalogScope(
  merchantId: string
): Promise<CatalogScope> {
  const rows = await db
    .select({
      category: products.category,
      count: sql<number>`count(*)`,
      fromPaise: sql<number>`min(${products.price})`,
    })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.isActive, true),
        gt(products.stock, 0),
        isNotNull(products.category)
      )
    )
    .groupBy(products.category)
    .orderBy(asc(products.category));

  const categories = rows.map((row) => ({
    category: row.category ?? "uncategorised",
    count: Number(row.count),
    fromPaise: Number(row.fromPaise),
  }));

  return {
    categories,
    cheapestPaise: categories.length
      ? Math.min(...categories.map((row) => row.fromPaise))
      : null,
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
 * A product plus everything an AI buyer needs to reason about it.
 *
 * `listActiveProducts` returns the product row alone, which is all the in-app
 * agent needs because it can call the compatibility engine directly. An
 * external buyer cannot, so the catalog it reads has to carry the typed specs
 * and the slot the part occupies.
 */
export interface CatalogRow {
  category: typeof productCategories.$inferSelect | null;
  product: Product;
  specs: typeof productSpecs.$inferSelect | null;
}

/** The catalog with its compatibility inputs attached. */
export async function listCatalogRows(
  merchantId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<CatalogRow[]> {
  return await db
    .select({
      category: productCategories,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    )
    .orderBy(desc(products.createdAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
}

/**
 * The typed specifications, as an AI buyer sees them.
 *
 * **Every null is deliberate and must survive the wire.** `product_specs`
 * exists because `products.attributes` — a free-form display blob — cannot be
 * validated against, and the whole value of the typed table is that a missing
 * spec reaches the compatibility engine as `insufficient_data` rather than as a
 * zero. Dropping null keys here to make the document tidier would erase exactly
 * the distinction the schema was built to preserve: a PSU with no wattage is
 * unknown, a GPU with `tdp_watts: 0` claims to draw nothing.
 *
 * Snake case throughout, to match the rest of the document rather than the
 * column names of a database no buyer can see.
 */
export interface CatalogSpecs {
  chipset: string | null;
  form_factor: string | null;
  height_mm: number | null;
  length_mm: number | null;
  m2_slots: number | null;
  max_cooler_height_mm: number | null;
  max_gpu_length_mm: number | null;
  memory_capacity_gb: number | null;
  memory_slots: number | null;
  memory_speed_mhz: number | null;
  memory_type: string | null;
  pcie_power_connectors: { count: number; pins: number }[] | null;
  psu_wattage: number | null;
  recommended_psu_watts: number | null;
  sata_ports: number | null;
  socket: string | null;
  storage_interface: string | null;
  tdp_watts: number | null;
  width_mm: number | null;
}

/** Where a part sits in a build, for an agent assembling one. */
export interface CatalogBuildSlot {
  category_slug: string;
  is_build_component: boolean;
  max_per_build: number | null;
  min_per_build: number;
  slot: string | null;
}

/**
 * Whether this listing is good enough for an agent to act on.
 *
 * The merchant already sees this number — `getCatalogReadiness` tells them what
 * fraction of their catalogue an AI buyer cannot properly recommend. Publishing
 * it closes the loop: a buying agent can tell a thin listing from a complete
 * one and say so, rather than silently walking past it, which is the outcome
 * the merchant's own screen is warning them about.
 */
export interface CatalogReadinessNote {
  /** True when something missing stops an agent recommending it at all. */
  blocked: boolean;
  /** The fields that are absent, named. Empty when nothing is. */
  missing: string[];
  /** 0–100. Nothing missing is 100. */
  score: number;
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
  build: CatalogBuildSlot | null;
  category: string | null;
  currency: string;
  description: string | null;
  id: string;
  image_url: string | null;
  in_stock: boolean;
  name: string;
  price_paise: number;
  readiness: CatalogReadinessNote;
  sku: string | null;
  specs: CatalogSpecs | null;
  stock: number;
}

function toCatalogSpecs(specs: typeof productSpecs.$inferSelect): CatalogSpecs {
  return {
    chipset: specs.chipset,
    form_factor: specs.formFactor,
    height_mm: specs.heightMm,
    length_mm: specs.lengthMm,
    m2_slots: specs.m2Slots,
    max_cooler_height_mm: specs.maxCoolerHeightMm,
    max_gpu_length_mm: specs.maxGpuLengthMm,
    memory_capacity_gb: specs.memoryCapacityGb,
    memory_slots: specs.memorySlots,
    memory_speed_mhz: specs.memorySpeedMhz,
    memory_type: specs.memoryType,
    pcie_power_connectors: specs.pciePowerConnectors ?? null,
    psu_wattage: specs.psuWattage,
    recommended_psu_watts: specs.recommendedPsuWatts,
    sata_ports: specs.sataPorts,
    socket: specs.socket,
    storage_interface: specs.storageInterface,
    tdp_watts: specs.tdpWatts,
    width_mm: specs.widthMm,
  };
}

export function toCatalogEntry(
  row: CatalogRow,
  currency: string,
  readiness: CatalogReadinessNote = { blocked: false, missing: [], score: 100 }
): CatalogEntry {
  const { category, product, specs } = row;

  return {
    attributes: product.attributes ?? null,
    brand: product.brand,
    build: category
      ? {
          category_slug: category.slug,
          is_build_component: category.isBuildComponent,
          max_per_build: category.maxPerBuild,
          min_per_build: category.minPerBuild,
          slot: category.buildSlot,
        }
      : null,
    category: product.category,
    currency,
    description: product.description,
    id: product.id,
    image_url: product.imageUrl,
    in_stock: product.stock > 0,
    name: product.name,
    price_paise: product.price,
    readiness,
    sku: product.sku,
    specs: specs ? toCatalogSpecs(specs) : null,
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
