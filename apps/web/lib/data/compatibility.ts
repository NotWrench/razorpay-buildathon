import { loadBuildComponents } from "@workspace/commerce/builds";
import type {
  BuildComponent,
  CompatibilityIssue,
  CompatibilityStatus,
} from "@workspace/commerce/compatibility";
import { validateBuild } from "@workspace/commerce/compatibility";
import { builds, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { currentBuyer } from "@/lib/store/buyer";
import { storeId } from "./store";
import type {
  CompatibilityCheck,
  CompatibilityReport,
  CompatibilityState,
} from "./types";

/**
 * The compatibility engine, as the storefront reads it.
 *
 * `packages/commerce/src/compatibility` is the authority — deterministic
 * rules over real spec columns, no model in the loop. This module does two
 * jobs and nothing else: find the build the shopper currently has open, and
 * translate the engine's vocabulary into the one the screens were designed
 * against. No verdict is computed here.
 */

/** The engine says `requires_verification`; the contract says `needs_...`. */
const STATE: Record<CompatibilityStatus, CompatibilityState> = {
  compatible: "compatible",
  incompatible: "incompatible",
  insufficient_data: "insufficient_data",
  requires_verification: "needs_verification",
};

/** A rule id is stable and unreadable. This is what the strip prints. */
const RULE_LABELS: Record<string, string> = {
  build_completeness: "Completeness",
  cooler_case_clearance: "Cooler clearance",
  cooler_cpu_socket: "Cooler socket",
  cpu_motherboard_socket: "Socket",
  gpu_case_clearance: "Card clearance",
  motherboard_case_form_factor: "Form factor",
  motherboard_ram_slots: "Memory slots",
  motherboard_ram_type: "Memory type",
  psu_gpu_connectors: "Power connectors",
  psu_wattage_headroom: "Power headroom",
  storage_interface_slots: "Storage slots",
};

const WORD_BOUNDARY = /_/g;

function labelFor(rule: string): string {
  const known = RULE_LABELS[rule];

  if (known) {
    return known;
  }

  const words = rule.replace(WORD_BOUNDARY, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toCheck(
  issue: CompatibilityIssue,
  names: Map<string, string>
): CompatibilityCheck {
  return {
    label: labelFor(issue.rule),
    message: issue.suggestion
      ? `${issue.message} ${issue.suggestion}`
      : issue.message,
    /* The engine names the parts inside its message; the strip turns those
       names into links, so it needs the id each one belongs to. */
    relatedProducts: issue.affectedProductIds
      .map((id) => ({ id, name: names.get(id) ?? "" }))
      .filter((entry) => entry.name !== ""),
    rule: issue.rule,
    state: STATE[issue.status],
  };
}

/**
 * The worst state present, in the order a buyer cares about.
 *
 * `insufficient_data` outranks `needs_verification` deliberately: "we could
 * not check" is a weaker claim than "we checked and it is tight", and the
 * headline must not promise more certainty than the checks contain.
 */
const SEVERITY: CompatibilityState[] = [
  "incompatible",
  "insufficient_data",
  "needs_verification",
  "compatible",
];

function worst(checks: CompatibilityCheck[]): CompatibilityState {
  for (const state of SEVERITY) {
    if (checks.some((check) => check.state === state)) {
      return state;
    }
  }

  return "compatible";
}

export interface OpenBuild {
  components: BuildComponent[];
  id: string;
  name: string;
  /** The slots it already fills, for the "fits my build" filter. */
  slots: string[];
}

/**
 * The build the shopper has open.
 *
 * The most recently touched draft, under their own identity — an agent that
 * assembled a build for them and a build they started by hand are the same
 * row, because both carry the same `buyer_identifier`. A shopper with no
 * draft has no open build, and every surface that asks about one says so
 * rather than inventing a set of parts to judge against.
 */
export const openBuild = cache(async (): Promise<OpenBuild | null> => {
  const merchantId = await storeId();
  const buyer = await currentBuyer();

  const build = await db.query.builds.findFirst({
    orderBy: desc(builds.updatedAt),
    where: and(
      eq(builds.merchantId, merchantId),
      eq(builds.buyerIdentifier, buyer.identifier),
      eq(builds.status, "draft")
    ),
    with: { items: true },
  });

  if (!build || build.items.length === 0) {
    return null;
  }

  try {
    const components = await loadBuildComponents(
      merchantId,
      build.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );

    return {
      components,
      id: build.id,
      name: build.name,
      slots: [...new Set(components.map((part) => part.categorySlug))],
    };
  } catch {
    /* A build referencing a part the merchant has since delisted cannot be
       validated. That is a broken build, not a broken product page. */
    return null;
  }
});

/**
 * The parts of a build a candidate would sit alongside.
 *
 * Whatever already holds the candidate's slot steps aside. Judging a build
 * with two processors in it would report a completeness rule the shopper
 * never broke, and answer a question nobody asked.
 */
function withCandidate(
  build: OpenBuild,
  candidate: BuildComponent
): BuildComponent[] {
  const rest = build.components.filter(
    (part) =>
      part.categorySlug !== candidate.categorySlug &&
      part.productId !== candidate.productId
  );

  return [...rest, candidate];
}

/**
 * Whether a part could join the open build at all.
 *
 * "Could not confirm" counts as could — refusing to shelf an imported card
 * because its distributor publishes no dimensions would hide a part the
 * shopper can perfectly well buy. Only a rule that actually fired excludes it.
 */
export function fitsOpenBuild(
  build: OpenBuild,
  candidate: BuildComponent
): boolean {
  const validation = validateBuild(withCandidate(build, candidate));

  return !validation.issues.some(
    (issue) => issue.status === "incompatible" && issue.severity === "blocking"
  );
}

/** Every check, run over an explicit set of parts. */
export function reportFor(
  components: BuildComponent[],
  buildName?: string
): CompatibilityReport {
  const validation = validateBuild(components);
  const names = new Map(
    components.map((part) => [part.productId, part.name] as const)
  );

  const checks = validation.issues.map((issue) => toCheck(issue, names));

  return {
    buildName,
    checks,
    estimatedWattage: validation.estimatedWattage,
    overall: checks.length > 0 ? worst(checks) : STATE[validation.status],
    psuRatedWattage: validation.recommendedPsuWattage,
  };
}

/**
 * How one part would sit in the build the shopper already has open.
 *
 * Undefined, not an empty report, when there is no build: the product page
 * distinguishes "checked, and it fits" from "there is nothing to check
 * against yet", and only the second gets the invitation to start one.
 */
export async function reportForProduct(
  productId: string
): Promise<CompatibilityReport | undefined> {
  const build = await openBuild();

  if (!build) {
    return;
  }

  const merchantId = await storeId();

  const [candidate] = await loadBuildComponents(merchantId, [
    { productId, quantity: 1 },
  ]);

  if (!candidate) {
    return;
  }

  return reportFor(withCandidate(build, candidate), build.name);
}
