import type { Product, ProductSpec } from "@workspace/db";
import type { CategorySlug } from "@workspace/db/taxonomy";

/**
 * Why one part is worth more than another.
 *
 * Split out from the assembler because it is pure — two parts in, a sentence
 * or nothing out — while the assembler needs a database. That split is not
 * bookkeeping: this is the code that decides what the agent offers to sell
 * somebody, and it has to be testable without standing up Postgres.
 *
 * Every reason here is a difference between two values the catalog actually
 * publishes. There is deliberately no way to say "better performance" — that
 * is a claim this data cannot support, and a sheet where every row carries an
 * offer is a sheet where no offer means anything.
 */

/**
 * One product the assembler may choose, with everything the rules read.
 *
 * `lowStockThreshold` is carried but never read here — it is what a caller
 * needs to say "only two left" without going back to the database for a row
 * this query already had.
 */
export interface Candidate {
  attributes: Record<string, unknown> | null;
  category: CategorySlug;
  lowStockThreshold: number | null;
  product: Product;
  specs: ProductSpec | null;
}

const CAPACITY = /(\d+)\s*(GB|TB)/i;
const TB_TO_GB = 1024;

function attribute(entry: Candidate, key: string): string | null {
  const value = entry.attributes?.[key];

  return typeof value === "string" ? value : null;
}

function capacityGb(entry: Candidate): number | null {
  if (entry.specs?.memoryCapacityGb) {
    return entry.specs.memoryCapacityGb;
  }

  const match = CAPACITY.exec(entry.product.name);

  if (!match?.[1]) {
    return null;
  }

  const size = Number(match[1]);

  return match[2]?.toUpperCase() === "TB" ? size * TB_TO_GB : size;
}

function readableGb(gb: number): string {
  return gb >= TB_TO_GB ? `${gb / TB_TO_GB}TB` : `${gb}GB`;
}

type Comparator = (from: Candidate, to: Candidate) => string | null;

/** The number an attribute leads with: 16 from "16GB GDDR6", 10 from "10C/16T". */
const LEADING_NUMBER = /^\s*(\d+(?:\.\d+)?)/;

function leadingNumber(value: string): number | null {
  const match = LEADING_NUMBER.exec(value);

  return match?.[1] ? Number(match[1]) : null;
}

/**
 * "10C/16T instead of 6C/12T" — a stated attribute, improved.
 *
 * Improved, not merely changed. Comparing these as strings says a 12GB card is
 * an upgrade over a 16GB one because the text differs, and the assembler will
 * happily offer ₹15,000 for less memory with that sentence attached — which is
 * both the worst kind of wrong answer and a well-argued one. Where both values
 * lead with a number, that number has to go up.
 *
 * Where they do not, difference is all this data supports, and the offer still
 * has to survive `upgradeFor`'s price and compatibility checks to be made at
 * all.
 */
export function describeAttributeChange(
  before: string | null,
  after: string | null
): string | null {
  if (!(before && after) || before === after) {
    return null;
  }

  const wasNumber = leadingNumber(before);
  const isNumber = leadingNumber(after);

  if (wasNumber !== null && isNumber !== null && isNumber <= wasNumber) {
    return null;
  }

  return `${after} instead of ${before}`;
}

function byAttribute(key: string): Comparator {
  return (from, to) =>
    describeAttributeChange(attribute(from, key), attribute(to, key));
}

/** "2TB instead of 1TB" — more of the thing the part is measured in. */
const byCapacity: Comparator = (from, to) => {
  const before = capacityGb(from);
  const after = capacityGb(to);

  return before && after && after > before
    ? `${readableGb(after)} instead of ${readableGb(before)}`
    : null;
};

/** A numeric spec that is better for being larger, said in its own units. */
function byNumber(
  field: "psuWattage" | "m2Slots" | "maxGpuLengthMm" | "tdpWatts",
  say: (before: number, after: number) => string
): Comparator {
  return (from, to) => {
    const before = from.specs?.[field];
    const after = to.specs?.[field];

    return before && after && after > before ? say(before, after) : null;
  };
}

/**
 * Why one part is worth more than another, per category.
 *
 * A category with no entry has no measurable upgrade story in this data, and
 * gets no offer — which is the point. A sheet where every row carries one is a
 * sheet where no offer means anything.
 */
const UPGRADE_REASON: Partial<Record<CategorySlug, Comparator>> = {
  case: byNumber(
    "maxGpuLengthMm",
    (before, after) => `${after} mm of card clearance instead of ${before} mm`
  ),
  cooler: byNumber(
    "tdpWatts",
    (before, after) => `rated to ${after} W instead of ${before} W`
  ),
  cpu: byAttribute("cores"),
  gpu: byAttribute("vram"),
  motherboard: byNumber(
    "m2Slots",
    (before, after) => `${after} M.2 slots instead of ${before}`
  ),
  psu: byNumber(
    "psuWattage",
    (before, after) => `${after - before} W more headroom`
  ),
  ram: byCapacity,
  storage: byCapacity,
};

export function describeUpgrade(from: Candidate, to: Candidate): string | null {
  return UPGRADE_REASON[from.category]?.(from, to) ?? null;
}

/** The cheapest part above this one that still validates and says why. */
