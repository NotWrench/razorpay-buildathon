import { db, type Product, products } from "@workspace/db";
import { embed, embedMany } from "ai";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import {
  embeddingModel,
  embeddingProviderOptions,
  hasEmbeddingCredentials,
} from "./provider";

/**
 * Product embeddings for semantic search.
 *
 * The text fed to the model is deliberately more than the product name: brand,
 * category and attributes are what let "noise cancelling headphones for a
 * flight" find a product whose description never uses those words.
 */

const BATCH_SIZE = 50;

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

export async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    providerOptions: embeddingProviderOptions(),
    value: query,
  });

  return embedding;
}

/**
 * Embeds products that have no embedding yet.
 *
 * Idempotent: run it after any import. Pass `force` to re-embed everything
 * after changing the embedding model.
 */
export async function backfillEmbeddings(
  options: { force?: boolean; merchantId?: string } = {}
): Promise<{ embedded: number; skipped: number }> {
  if (!hasEmbeddingCredentials()) {
    return { embedded: 0, skipped: 0 };
  }

  const filters: SQL[] = [];

  if (options.merchantId) {
    filters.push(eq(products.merchantId, options.merchantId));
  }

  if (!options.force) {
    filters.push(isNull(products.embedding));
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
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      providerOptions: embeddingProviderOptions(),
      values: batch.map(embeddableText),
    });

    await Promise.all(
      batch.map((product, position) => {
        const embedding = embeddings[position];

        if (!embedding) {
          return Promise.resolve();
        }

        embedded += 1;

        return db
          .update(products)
          .set({ embedding })
          .where(eq(products.id, product.id));
      })
    );
  }

  return { embedded, skipped: pending.length - embedded };
}
