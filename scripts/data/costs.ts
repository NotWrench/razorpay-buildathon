import type { CategorySlug } from "@workspace/db";

/**
 * What the shop paid, per category.
 *
 * **These are synthetic.** No real supplier invoices went into them, and
 * nothing in the system should present them as anything else. They exist
 * because the alternative is worse: with `cost_price` null across the board,
 * every margin tool reports zero coverage, the margin floor never engages, and
 * the whole of M2 is untestable against the demo store.
 *
 * The ratios are chosen to be *directionally* right for Indian PC-component
 * retail, because a margin model that says a graphics card earns the same as a
 * case fan would send the assistant's discount advice the wrong way on exactly
 * the products it will be asked about most. Silicon is close to cost and moves
 * on volume; chassis, cooling and power carry the shop.
 *
 * A cost of 0.88 means the shop pays 88% of what it charges — a 12% gross
 * margin before any discount.
 */
const COST_RATIO: Record<CategorySlug, number> = {
  case: 0.72,
  cooler: 0.7,
  cpu: 0.92,
  fan: 0.62,
  gpu: 0.9,
  monitor: 0.82,
  motherboard: 0.85,
  peripheral: 0.68,
  psu: 0.76,
  ram: 0.87,
  storage: 0.86,
};

/**
 * Products left deliberately without a cost.
 *
 * Every real catalogue has holes in it — a part bought on a one-off deal, an
 * import nobody re-costed. Seeding a perfect one would mean the coverage
 * reporting has nothing to report and the "some products have no cost" path
 * never runs outside a unit test. These four are the same parts the catalogue
 * already uses to exercise its other missing-data paths.
 */
const UNCOSTED_SKUS = new Set([
  "GPU-INT-A750",
  "CSE-ANT-ICE200",
  "FAN-ARCT-P12-5",
  "MON-ACER-KG241Y",
]);

/**
 * The cost of one unit in paise, or null when the shop has not recorded one.
 *
 * Rounded to whole rupees, because a supplier price with paise on the end is a
 * number nobody typed.
 */
export function seedCostPaise(
  sku: string,
  categorySlug: CategorySlug,
  priceRupees: number
): number | null {
  if (UNCOSTED_SKUS.has(sku)) {
    return null;
  }

  const ratio = COST_RATIO[categorySlug];

  if (!ratio) {
    return null;
  }

  return Math.round(priceRupees * ratio) * 100;
}
