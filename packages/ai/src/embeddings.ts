import { db, type Product, products } from "@workspace/db";
import { embed, embedMany } from "ai";
import { and, eq, isNull, ne, or, type SQL } from "drizzle-orm";
import {
  cachedEmbedding,
  cacheKey,
  embeddingQuotaExhausted,
  isQuotaError,
  noteEmbeddingFailure,
  rememberEmbedding,
} from "./embedding-budget";
import {
  embeddingModel,
  embeddingModelId,
  embeddingProviderOptions,
  hasEmbeddingCredentials,
  toColumnVector,
} from "./provider";

/**
 * Product embeddings for semantic search.
 *
 * The text fed to the model is deliberately more than the product name: brand,
 * category and attributes are what let "noise cancelling headphones for a
 * flight" find a product whose description never uses those words.
 *
 * Everything here goes through one embedding provider and records which one on
 * the row, because two models' vectors are incomparable rather than merely
 * different — see `products.embeddingModel`.
 */

/**
 * Products per request during a backfill.
 *
 * Small on purpose. A whole batch is one provider call, so a batch that fails
 * on quota is a batch that has to be retried in full, and a smaller unit of
 * work loses less to each 429.
 */
const BATCH_SIZE = 25;

const MAX_BATCH_ATTEMPTS = 4;
const RETRY_BASE_MS = 2000;

export function embeddableText(product: Product): string {
  const attributes = product.attributes
    ? Object.entries(product.attributes)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ")
    : "";

  return [
    product.name,
    product.brand,
    product.category,
    product.description,
    attributes,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Embeds a buyer's query, or returns undefined when it cannot.
 *
 * Undefined is a normal answer, not an error: no provider key, an exhausted
 * quota, or an unreachable daemon all mean "semantic search is unavailable for
 * this turn", and the caller has a lexical path for exactly that. Failing the
 * turn instead would make an optional enhancement into a dependency.
 *
 * No retries. The caller's fallback is cheaper than the SDK's default backoff,
 * which stalls a turn for tens of seconds before returning the same rows the
 * lexical path would have returned immediately.
 */
export async function embedQuery(query: string): Promise<number[] | undefined> {
  if (!hasEmbeddingCredentials() || embeddingQuotaExhausted()) {
    return;
  }

  const key = cacheKey(embeddingModelId(), query);
  const cached = cachedEmbedding(key);

  if (cached) {
    return cached;
  }

  try {
    const { embedding } = await embed({
      maxRetries: 0,
      model: embeddingModel(),
      providerOptions: embeddingProviderOptions("query"),
      value: query,
    });

    const vector = toColumnVector(embedding);

    rememberEmbedding(key, vector);

    return vector;
  } catch (error) {
    if (noteEmbeddingFailure(error)) {
      console.warn(
        "Embedding quota exhausted — search falls back to lexical matching until the cooldown expires."
      );
    } else if (!isQuotaError(error)) {
      console.error("Query embedding failed, falling back to lexical", error);
    }
  }
}

/**
 * Embeds one batch of product text, waiting out a quota refusal.
 *
 * A backfill is the one caller that should wait rather than degrade: it is a
 * background job with nobody watching a spinner, and half an embedded catalog
 * is worse than a slow one. Anything that is not a quota error is a bug and
 * fails immediately.
 */
async function embedBatch(values: string[]): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: retries are sequential by definition
      const { embeddings } = await embedMany({
        maxRetries: 0,
        model: embeddingModel(),
        providerOptions: embeddingProviderOptions("document"),
        values,
      });

      return embeddings.map(toColumnVector);
    } catch (error) {
      lastError = error;

      if (!isQuotaError(error)) {
        throw error;
      }

      const waitMs = RETRY_BASE_MS * 2 ** attempt;

      console.warn(
        `Embedding quota hit — waiting ${Math.round(waitMs / 1000)}s before retrying this batch.`
      );

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

/**
 * Embeds products that have no usable embedding.
 *
 * "Usable" means written by the model that is embedding queries right now:
 * after an embedding-model change, every row is stale and re-embedding is the
 * only thing that makes semantic search work again, so this picks them up
 * without `force`. `force` remains for re-embedding rows the model would
 * otherwise consider current — after a change to `embeddableText`, say.
 *
 * Idempotent either way: run it after any import.
 */
export async function backfillEmbeddings(
  options: { force?: boolean; merchantId?: string } = {}
): Promise<{ embedded: number; skipped: number }> {
  if (!hasEmbeddingCredentials()) {
    return { embedded: 0, skipped: 0 };
  }

  const modelId = embeddingModelId();
  const filters: SQL[] = [];

  if (options.merchantId) {
    filters.push(eq(products.merchantId, options.merchantId));
  }

  if (!options.force) {
    const stale = or(
      isNull(products.embedding),
      isNull(products.embeddingModel),
      ne(products.embeddingModel, modelId)
    );

    if (stale) {
      filters.push(stale);
    }
  }

  const pending = await db
    .select()
    .from(products)
    .where(filters.length > 0 ? and(...filters) : undefined);

  let embedded = 0;

  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE);

    // Batches run one after another deliberately: firing every batch at once
    // trips the embedding provider's rate limit on a catalog of any size.
    // biome-ignore lint/performance/noAwaitInLoops: sequential by design
    const embeddings = await embedBatch(batch.map(embeddableText));

    await Promise.all(
      batch.map((product, position) => {
        const embedding = embeddings[position];

        if (!embedding) {
          return Promise.resolve();
        }

        embedded += 1;

        return db
          .update(products)
          .set({ embedding, embeddingModel: modelId })
          .where(eq(products.id, product.id));
      })
    );
  }

  return { embedded, skipped: pending.length - embedded };
}
