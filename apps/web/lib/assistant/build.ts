import { getCategoryDefinition } from "@workspace/db/taxonomy";
import { MOCK_PRODUCTS_BY_ID } from "@/lib/mock/products";
import type { CompatibilityState, ProductSummary } from "@/lib/mock/types";

/**
 * The recommendation the assistant produces, and the rules that keep judging
 * it as the shopper edits.
 *
 * Nothing here caches a verdict. Every uncheck and every swap re-runs
 * `validateBuild` over the current selection, because a compatibility result
 * that was true about a different set of parts is worse than no result — it
 * looks authoritative and is wrong.
 *
 * (`packages/commerce/src/compatibility` is the real engine. Its status
 * vocabulary says `requires_verification` where this mock says
 * `needs_verification`; that mapping is a one-liner when the two are joined.)
 */

export interface BuildUpgrade {
  deltaPaise: number;
  product: ProductSummary;
  /** Measurable, from the data. Never "better performance". */
  reason: string;
}

export interface BuildSlotRow {
  recommended: ProductSummary;
  required: boolean;
  selected: boolean;
  slot: string;
  /** The slug the taxonomy knows this slot by. */
  slug: string;
  swapped: boolean;
  /** Absent on most rows. Absence is the default. */
  upgrade?: BuildUpgrade;
}

export interface RecommendedBuild {
  basis: string;
  rows: BuildSlotRow[];
}

function product(id: string): ProductSummary {
  const found = MOCK_PRODUCTS_BY_ID.get(id);

  if (!found) {
    throw new Error(`The recommended build references an unknown part: ${id}`);
  }

  return found;
}

function row(
  slug: string,
  slot: string,
  id: string,
  upgrade?: { id: string; reason: string }
): BuildSlotRow {
  const recommended = product(id);
  const definition = getCategoryDefinition(slug);

  return {
    recommended,
    required: (definition?.minPerBuild ?? 0) > 0,
    selected: true,
    slot,
    slug,
    swapped: false,
    upgrade: upgrade
      ? {
          deltaPaise: product(upgrade.id).pricePaise - recommended.pricePaise,
          product: product(upgrade.id),
          reason: upgrade.reason,
        }
      : undefined,
  };
}

/**
 * Eight slots, four upgrades.
 *
 * Half the rows carry no upgrade at all and render an empty lane. If every row
 * had an offer, none of them would mean anything — the absence is what makes
 * the four that remain worth reading.
 */
export function recommendBuild(
  answers: Record<string, string | undefined>
): RecommendedBuild {
  const budget = Number(answers.budget ?? 0);
  const use = answers.use ?? "Gaming";
  const resolution = answers.resolution ?? "1440p";

  return {
    basis: [
      budget ? `₹${budget.toLocaleString("en-IN")}` : null,
      resolution,
      use.toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    rows: [
      row("cpu", "Processor", "cpu-2", {
        id: "cpu-1",
        reason: "~19% more FPS in CPU-bound games",
      }),
      row("motherboard", "Motherboard", "motherboard-1"),
      row("ram", "Memory", "ram-1", {
        id: "ram-2",
        reason: "64GB instead of 32GB, same CL32 latency",
      }),
      row("gpu", "Graphics", "gpu-2", {
        id: "gpu-1",
        reason: "~28% more FPS at 1440p",
      }),
      row("storage", "Storage", "storage-1"),
      row("psu", "Power supply", "psu-1", {
        id: "psu-2",
        reason: "350 W more headroom, 80+ Platinum",
      }),
      row("case", "Case", "case-1"),
      row("cooler", "Cooling", "cooler-2"),
    ],
  };
}

/** The part a row currently contributes — the upgrade once it is swapped. */
export function partFor(entry: BuildSlotRow): ProductSummary {
  return entry.swapped && entry.upgrade
    ? entry.upgrade.product
    : entry.recommended;
}

export interface BuildVerdict {
  canContinue: boolean;
  message: string;
  /** Slots that are required and currently unchecked. */
  missing: string[];
  /**
   * What the missing slots mean, said once, beneath the sheet. The footer
   * keeps reporting compatibility — the two are different questions and
   * printing the same sentence in both places reads as a bug.
   */
  requirement: string | null;
  state: CompatibilityState;
  totalPaise: number;
  upgradePaise: number;
}

const HEADROOM = 150;

function wattage(part: ProductSummary): number {
  const spec = part.keySpecs.find((entry) => entry.label === "Board power");

  return spec ? Number.parseInt(spec.value, 10) : 0;
}

function supplyWattage(part: ProductSummary): number {
  const spec = part.keySpecs.find((entry) => entry.label === "Output");

  return spec ? Number.parseInt(spec.value, 10) : 0;
}

/**
 * Re-run from scratch over whatever is currently ticked.
 *
 * Unticking a required slot never blocks the sheet — it reports, and the
 * Continue pill goes quiet. A modal here would be the app refusing to let
 * someone look at their own build.
 */
export function validateBuild(rows: BuildSlotRow[]): BuildVerdict {
  const chosen = rows.filter((entry) => entry.selected);
  const parts = chosen.map(partFor);

  const totalPaise = parts.reduce((total, part) => total + part.pricePaise, 0);
  const upgradePaise = rows
    .filter((entry) => entry.selected && entry.swapped && entry.upgrade)
    .reduce((total, entry) => total + (entry.upgrade?.deltaPaise ?? 0), 0);

  const missing = rows
    .filter((entry) => entry.required && !entry.selected)
    .map((entry) => entry.slot.toLowerCase());

  /* Reported, never blocking. The Continue pill goes quiet and that is all. */
  const requirement =
    missing.length > 0
      ? `No ${missing.join(" and no ")} selected. Required for a complete build.`
      : null;
  const canContinue = missing.length === 0;

  /* Base draw for everything that is not the card. */
  const draw = 205 + parts.reduce((total, part) => total + wattage(part), 0);
  const supply = Math.max(...parts.map(supplyWattage), 0);

  if (supply === 0) {
    return {
      canContinue,
      message: "No supply selected, so power headroom cannot be checked.",
      missing,
      requirement,
      state: "insufficient_data",
      totalPaise,
      upgradePaise,
    };
  }

  if (supply - draw < HEADROOM) {
    return {
      canContinue,
      message: `${draw} W draw against a ${supply} W supply leaves ${supply - draw} W — under the ${HEADROOM} W this engine wants for transients.`,
      missing,
      requirement,
      state: "incompatible",
      totalPaise,
      upgradePaise,
    };
  }

  return {
    canContinue,
    message: `All ${chosen.length} parts compatible · ${draw} W against a ${supply} W supply.`,
    missing,
    requirement,
    state: "compatible",
    totalPaise,
    upgradePaise,
  };
}
