/**
 * Embeds every product whose embedding is missing or stale.
 *
 *   bun run embed          # fill in the gaps
 *   bun run embed --force  # re-embed everything, after changing what is embedded
 *
 * "Stale" means written by a different embedding model than the one currently
 * configured, which the row records. A model change therefore needs no flag:
 * every row is stale, semantic search finds nothing until this has run, and the
 * catalog searches lexically in the meantime.
 *
 * Semantic search is an enhancement, not a dependency: with no provider key the
 * catalog still searches lexically, so skipping this only costs recall.
 */

import {
  backfillEmbeddings,
  describeEmbeddingProvider,
  hasEmbeddingCredentials,
} from "@workspace/ai";

async function main() {
  if (!hasEmbeddingCredentials()) {
    console.log(
      "No embedding provider configured — skipping. Search falls back to lexical matching. Set GEMINI_API_KEY, or AI_EMBEDDING_PROVIDER=ollama for a local model with no quota."
    );
    process.exit(0);
  }

  const force = process.argv.includes("--force");

  console.log(`Embedder: ${describeEmbeddingProvider()}`);
  console.log(
    force
      ? "Re-embedding all products..."
      : "Embedding new and stale products..."
  );

  const result = await backfillEmbeddings({ force });

  console.log(`Embedded ${result.embedded} product(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
