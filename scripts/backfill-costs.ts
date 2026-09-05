/**
 * Fills in `cost_price` for a store seeded before the column existed.
 *
 * `products.cost_price` is nullable and arrived after the demo store did, so
 * an existing database has a full catalogue and no costs — which means every
 * margin figure reports zero coverage and the margin floor never engages. A
 * re-seed would fix that and throw away the order history the analytics are
 * measured over, so this walks the catalogue instead.
 *
 * It only ever writes where the cost is currently null. Running it twice is
 * safe, and a cost somebody typed by hand is never overwritten by a synthetic
 * one — see `scripts/data/costs.ts` for what "synthetic" means here and why
 * four products are deliberately left without one.
 *
 *   bun run scripts/backfill-costs.ts
 */

import { db, isCategorySlug, products } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { seedCostPaise } from "./data/costs";

const PAISE_PER_RUPEE = 100;

async function main() {
  const rows = await db
    .select({
      category: products.category,
      id: products.id,
      name: products.name,
      price: products.price,
      sku: products.sku,
    })
    .from(products)
    .where(isNull(products.costPrice));

  if (rows.length === 0) {
    console.log("Every product already has a cost recorded. Nothing to do.");
    process.exit(0);
  }

  let written = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!(row.sku && row.category && isCategorySlug(row.category))) {
      skipped += 1;
      continue;
    }

    const costPaise = seedCostPaise(
      row.sku,
      row.category,
      row.price / PAISE_PER_RUPEE
    );

    if (costPaise === null) {
      skipped += 1;
      continue;
    }

    await db
      .update(products)
      .set({ costPrice: costPaise })
      .where(and(eq(products.id, row.id), isNull(products.costPrice)));

    written += 1;
  }

  console.log(`Costed ${written} product(s).`);
  console.log(
    `Left ${skipped} without a cost — deliberately, or because nothing in the ratio table covers their category.`
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
