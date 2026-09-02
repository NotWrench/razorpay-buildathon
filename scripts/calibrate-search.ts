/**
 * Measures where the semantic-search relevance threshold belongs.
 *
 *   bun run calibrate:search
 *
 * `AI_SEARCH_MIN_LEAD` decides whether a set of search results is about the
 * query at all, and its value is a property of the embedding model rather than
 * a matter of taste — so it should be measured, not guessed, and re-measured
 * after any change to the embedding model or to `embeddableText`.
 *
 * The method: for a query, score every product, and take the gap between the
 * best score and the catalog's median score for that same query. A query for
 * something the store sells leaves a wide gap. A query for something it does
 * not sell leaves almost none, because when nothing is relevant everything is
 * equally irrelevant and the whole catalog bunches together. The two
 * populations separate cleanly on that gap and not on the raw score, which is
 * the entire reason the threshold is expressed as a lead.
 *
 * Costs one embedding request per probe — around twenty, against a quota that
 * is the tightest in this stack. Run it deliberately, not on every boot.
 */

import {
  describeEmbeddingProvider,
  embedQuery,
  hasEmbeddingCredentials,
} from "@workspace/ai";
import { CATEGORY_DEFINITIONS, db, products } from "@workspace/db";
import { and, cosineDistance, eq, isNotNull, sql } from "drizzle-orm";

/**
 * Things no PC-component store sells.
 *
 * The point of the negative set is that these are plausible shopping requests,
 * not gibberish: "a laptop for ₹5,000" is what a real buyer typed, and the
 * search returned eight cheap components ranked by how little they resembled
 * one.
 */
const ABSENT = [
  "a laptop for 5000rs",
  "i need a laptop",
  "a printer",
  "washing machine",
  "running shoes",
  "an iphone",
];

/**
 * How far above the strongest false positive to place the threshold.
 *
 * Small: the gap between the two populations is measured in hundredths, so a
 * generous margin here would reject real queries to buy headroom that the
 * distribution does not actually offer.
 */
const OVERLAP_MARGIN = 0.013;

interface Probe {
  kind: "absent" | "present";
  lead: number;
  median: number;
  query: string;
  top: number;
  topName: string;
}

async function probe(
  merchantId: string,
  query: string,
  kind: Probe["kind"]
): Promise<Probe | undefined> {
  const embedding = await embedQuery(query);

  if (!embedding) {
    return;
  }

  const similarity = sql<number>`1 - (${cosineDistance(products.embedding, embedding)})`;

  const scope = and(
    eq(products.merchantId, merchantId),
    eq(products.isActive, true),
    isNotNull(products.embedding)
  );

  const [background] = await db
    .select({
      median: sql<number>`percentile_cont(0.5) within group (order by ${similarity})`,
    })
    .from(products)
    .where(scope);

  const [best] = await db
    .select({ name: products.name, score: similarity })
    .from(products)
    .where(scope)
    .orderBy(sql`${similarity} desc`)
    .limit(1);

  if (!(background && best)) {
    return;
  }

  const top = Number(best.score);
  const median = Number(background.median);

  return { kind, lead: top - median, median, query, top, topName: best.name };
}

async function main() {
  if (!hasEmbeddingCredentials()) {
    console.log("No embedding provider configured — nothing to calibrate.");
    process.exit(0);
  }

  const merchant = await db.query.merchants.findFirst();

  if (!merchant) {
    console.log("No merchant found. Run `bun run seed` first.");
    process.exit(1);
  }

  const [stocked] = await db
    .select({ embedded: sql<number>`count(${products.embedding})` })
    .from(products)
    .where(eq(products.merchantId, merchant.id));

  if (!stocked || Number(stocked.embedded) < 8) {
    console.log(
      "Fewer than 8 embedded products. Run `bun run embed` first — there is no distribution to measure."
    );
    process.exit(1);
  }

  console.log(`Store:    ${merchant.businessName}`);
  console.log(`Embedder: ${describeEmbeddingProvider()}\n`);

  // Phrased the way a buyer would, not the way the taxonomy is written: "a
  // memory" is not a query anyone types, and calibrating on phrasing nobody
  // uses would set the threshold from a sentence the model has never had to
  // handle.
  const present = CATEGORY_DEFINITIONS.map(
    (definition) => `${definition.name.toLowerCase()} for my pc`
  );

  const results: Probe[] = [];

  for (const query of present) {
    // biome-ignore lint/performance/noAwaitInLoops: one request at a time, by design
    const row = await probe(merchant.id, query, "present");

    if (row) {
      results.push(row);
    }
  }

  for (const query of ABSENT) {
    // biome-ignore lint/performance/noAwaitInLoops: one request at a time, by design
    const row = await probe(merchant.id, query, "absent");

    if (row) {
      results.push(row);
    }
  }

  if (results.length === 0) {
    console.log(
      "Every probe failed to embed — the provider quota is likely exhausted. Try again later."
    );
    process.exit(1);
  }

  for (const row of results.sort((a, b) => b.lead - a.lead)) {
    console.log(
      `  ${row.kind === "present" ? "SELLS  " : "ABSENT "} lead=${row.lead.toFixed(3)}  top=${row.top.toFixed(3)}  median=${row.median.toFixed(3)}  ${row.query}  ->  ${row.topName}`
    );
  }

  const leads = (kind: Probe["kind"]) =>
    results.filter((row) => row.kind === kind).map((row) => row.lead);

  const presentLeads = leads("present");
  const absentLeads = leads("absent");

  if (presentLeads.length === 0 || absentLeads.length === 0) {
    console.log("\nNot enough probes to recommend a threshold.");
    process.exit(1);
  }

  const worstPresent = Math.min(...presentLeads);
  const bestAbsent = Math.max(...absentLeads);

  console.log(
    `\nWeakest query for something the store sells:  ${worstPresent.toFixed(3)}`
  );
  console.log(
    `Strongest query for something it does not:   ${bestAbsent.toFixed(3)}`
  );

  // The threshold has to clear every absent probe, because letting one through
  // is the bug this exists to prevent: a store with no laptops answering "a
  // laptop for 5000rs" with its eight cheapest components. Where a real query
  // also falls below it, that is a fact to report rather than to average away
  // — the honest recommendation is the one that says which queries it gives up
  // on and leaves to lexical matching.
  const recommended = bestAbsent + OVERLAP_MARGIN;

  const sacrificed = results.filter(
    (row) => row.kind === "present" && row.lead < recommended
  );

  console.log(`\nAI_SEARCH_MIN_LEAD=${recommended.toFixed(3)}`);

  if (sacrificed.length === 0) {
    console.log(
      `Margin on either side: ${((worstPresent - bestAbsent) / 2).toFixed(3)}. A thin margin means the next unusual query will land on the wrong side of it.`
    );
    process.exit(0);
  }

  console.log(
    `\n${sacrificed.length} real quer${sacrificed.length === 1 ? "y falls" : "ies fall"} below that and will be answered lexically instead:`
  );

  for (const row of sacrificed) {
    console.log(`  ${row.lead.toFixed(3)}  ${row.query}`);
  }

  console.log(
    "\nThat is the right trade when those queries name a category outright, which lexical search matches exactly. If any of them is a phrase only a vector could understand, the embedding is the thing to fix — widen `embeddableText`, or check that queries and products are embedded with different task types."
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
