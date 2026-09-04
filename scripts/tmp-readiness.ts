import { describeReadiness, getCatalogReadiness } from "@workspace/ai";
import { db, merchants } from "@workspace/db";

const [store] = await db.select().from(merchants).limit(1);

if (!store) {
  throw new Error("no store");
}

const readiness = await getCatalogReadiness(store.id);

console.log(describeReadiness(readiness));
console.log("score:", readiness.score, "of", readiness.productsScored);
console.log("gaps:", JSON.stringify(readiness.gapCounts, null, 2));
console.log(
  "worst:",
  JSON.stringify(
    readiness.blocked.slice(0, 3).map((p) => ({
      gaps: p.gaps.map((g) => g.detail),
      name: p.name,
      score: p.score,
    })),
    null,
    2
  )
);

process.exit(0);
