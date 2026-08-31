/**
 * Embeds every product that has no embedding yet.
 *
 *   bun run embed          # fill in the gaps
 *   bun run embed --force  # re-embed everything, after a model change
 *
 * Semantic search is an enhancement, not a dependency: with no provider key the
 * catalog still searches lexically, so skipping this only costs recall.
 */

import { backfillEmbeddings, hasEmbeddingCredentials } from "@workspace/ai";

async function main() {
  if (!hasEmbeddingCredentials()) {
    console.log(
      "No GEMINI_API_KEY set — skipping. Search falls back to lexical matching."
    );
    process.exit(0);
  }

  const force = process.argv.includes("--force");

  console.log(
    force ? "Re-embedding all products..." : "Embedding new products..."
  );

  const result = await backfillEmbeddings({ force });

  console.log(`Embedded ${result.embedded} product(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
