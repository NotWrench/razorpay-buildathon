import type {
  BuildComponent,
  CompatibilityStatus,
} from "@workspace/commerce/compatibility";
import { validateBuild as runEngine } from "@workspace/commerce/compatibility";
import type { BuildSlotRow } from "@/lib/data/recommend";
import type { CompatibilityState, ProductSummary } from "@/lib/data/types";

/**
 * The half of the recommendation that runs in the browser.
 *
 * Choosing the parts is a server job — it reads the catalogue and the spec
 * columns, and it lives in `packages/ai/src/build-assembly.ts`, which the
 * agent reaches through its `assembleBuild` tool. What is left here is the
 * re-check that has to run on every tick and every swap, over rows the client
 * already holds.
 *
 * It re-checks by calling the *same engine* the server and the checkout call.
 * `packages/commerce/src/compatibility` is pure functions over spec values
 * with no database in them, so the rows carry their specs and the rules run
 * here unchanged. The alternative — restating the power rule in the client —
 * is how a sheet ends up recommending a supply it then flags, which is what
 * this file used to do.
 *
 * Nothing here caches a verdict. Every uncheck and every swap re-runs the
 * rules over the current selection, because a compatibility result that was
 * true about a different set of parts is worse than no result: it looks
 * authoritative and is wrong.
 */

export type { BuildSlotRow, BuildUpgrade } from "@/lib/data/recommend";

/** The engine says `requires_verification`; the contract says `needs_...`. */
const STATE: Record<CompatibilityStatus, CompatibilityState> = {
  compatible: "compatible",
  incompatible: "incompatible",
  insufficient_data: "insufficient_data",
  requires_verification: "needs_verification",
};

/** The part a row currently contributes — the upgrade once it is swapped. */
export function partFor(entry: BuildSlotRow): ProductSummary {
  return entry.swapped && entry.upgrade
    ? entry.upgrade.product
    : entry.recommended;
}

/** And the specs the rules read, which move with it. */
function componentFor(entry: BuildSlotRow): BuildComponent {
  return entry.swapped && entry.upgrade
    ? entry.upgrade.component
    : entry.component;
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

  const validation = runEngine(chosen.map(componentFor));

  /* Completeness is the `requirement` line's job — reporting the same fact
     twice, in two wordings, reads as two separate problems. */
  const relevant = validation.issues.filter(
    (issue) => issue.rule !== "build_completeness"
  );

  const worst =
    relevant.find((issue) => issue.status === "incompatible") ??
    relevant.find((issue) => issue.status === "insufficient_data") ??
    relevant.find((issue) => issue.status === "requires_verification");

  return {
    canContinue: missing.length === 0 && parts.length > 0,
    message: worst
      ? worst.message
      : `All ${chosen.length} parts compatible · ${validation.estimatedWattage} W estimated draw.`,
    missing,
    requirement,
    state: worst ? STATE[worst.status] : "compatible",
    totalPaise,
    upgradePaise,
  };
}
