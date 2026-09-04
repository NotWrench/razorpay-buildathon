import type { AssembledSlot, Candidate } from "@workspace/ai";
import { assembleBuild } from "@workspace/ai";
import type { BuildComponent } from "@workspace/commerce/compatibility";
import { toSummary } from "./product";
import { storeId } from "./store";
import type { ProductSummary } from "./types";

/**
 * The recommendation the assistant hands back, as the storefront draws it.
 *
 * The choosing does not happen here any more. Picking eight parts that fit
 * each other is §4 work — safety-critical commerce validation that must not
 * depend on model reasoning — and it now lives in `@workspace/ai`'s
 * `assembleBuild`, where the agent's own tool reaches the same function. Two
 * implementations of "which power supply does this build need" is exactly the
 * bug that would never be noticed: both would look right, and they would
 * disagree only on the builds nobody tested.
 *
 * What is left here is the part that was always the storefront's: turning
 * chosen rows into something a person can look at. `toSummary` is where the
 * image, the headline specs and the stock badge come from, and none of that
 * belongs in a package the model talks to.
 */

export interface BuildUpgrade {
  /**
   * The same part as the engine reads it, carried so the sheet can re-check
   * a swap against the real rules rather than against a local restatement of
   * them. See `lib/assistant/build.ts`.
   */
  component: BuildComponent;
  deltaPaise: number;
  product: ProductSummary;
  /** Measurable, from the spec columns. Never "better performance". */
  reason: string;
}

export interface BuildSlotRow {
  component: BuildComponent;
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
  /** What the engine said about the set as recommended. */
  message: string;
  rows: BuildSlotRow[];
}

const PAISE = 100;

/**
 * A candidate is already shaped like the row `toSummary` reads — same product,
 * same specs, same stock threshold, carried out of the one query that loaded
 * them. Naming that here rather than rebuilding the object keeps the two in
 * step if either gains a column.
 */
function summarise(candidate: Candidate): ProductSummary {
  return toSummary(candidate);
}

function toRow(slot: AssembledSlot): BuildSlotRow {
  return {
    component: slot.component,
    recommended: summarise(slot.candidate),
    required: slot.required,
    selected: true,
    slot: slot.label,
    slug: slot.slug,
    swapped: false,
    upgrade: slot.upgrade
      ? {
          component: slot.upgrade.component,
          deltaPaise: slot.upgrade.deltaPaise,
          product: summarise(slot.upgrade.candidate),
          reason: slot.upgrade.reason,
        }
      : undefined,
  };
}

/**
 * Builds a machine from the interview's answers.
 *
 * The answers arrive as a free-form record because the question set changes;
 * anything absent is an unanswered question, which the assembler already has
 * to cope with.
 */
export async function recommendBuild(
  answers: Record<string, string | undefined>
): Promise<RecommendedBuild> {
  const budgetRupees = Number(answers.budget ?? 0);

  const assembled = await assembleBuild({
    budgetPaise: budgetRupees > 0 ? budgetRupees * PAISE : null,
    merchantId: await storeId(),
    targetResolution: answers.resolution ?? null,
    useCase: answers.use ?? null,
  });

  return {
    basis: assembled.basis,
    message: assembled.message,
    rows: assembled.slots.map(toRow),
  };
}
