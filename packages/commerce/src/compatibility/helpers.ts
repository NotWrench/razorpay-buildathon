import type { PciePowerConnector } from "@workspace/db/schema/specs";
import type { CategorySlug } from "@workspace/db/taxonomy";
import type {
  BuildComponent,
  CompatibilityIssue,
  CompatibilityStatus,
  IssueSeverity,
} from "./types";

/**
 * Shared machinery for the rules.
 *
 * Everything here is about one thing: making "this specification is missing"
 * as easy to express as "these two values differ", so no rule is ever tempted
 * to treat a null as a pass.
 */

/** Worst-first, so `worstStatus` can pick by index. */
const STATUS_SEVERITY: CompatibilityStatus[] = [
  "incompatible",
  "insufficient_data",
  "requires_verification",
  "compatible",
];

const SEVERITY_BY_STATUS: Record<CompatibilityStatus, IssueSeverity> = {
  compatible: "info",
  incompatible: "blocking",
  insufficient_data: "warning",
  requires_verification: "warning",
};

/** The default severity for a status. Rules may override where it matters. */
export function severityFor(status: CompatibilityStatus): IssueSeverity {
  return SEVERITY_BY_STATUS[status];
}

export function worstStatus(
  statuses: CompatibilityStatus[]
): CompatibilityStatus {
  let worstIndex = STATUS_SEVERITY.length - 1;

  for (const status of statuses) {
    const index = STATUS_SEVERITY.indexOf(status);

    if (index >= 0 && index < worstIndex) {
      worstIndex = index;
    }
  }

  return STATUS_SEVERITY[worstIndex] ?? "compatible";
}

/** Build an issue, defaulting the severity from the status. */
export function issue(
  input: Omit<CompatibilityIssue, "severity"> & { severity?: IssueSeverity }
): CompatibilityIssue {
  return {
    affectedProductIds: input.affectedProductIds,
    message: input.message,
    missingSpecs: input.missingSpecs,
    rule: input.rule,
    severity: input.severity ?? severityFor(input.status),
    status: input.status,
    suggestion: input.suggestion,
  };
}

export function componentsOf(
  components: BuildComponent[],
  slug: CategorySlug
): BuildComponent[] {
  return components.filter((component) => component.categorySlug === slug);
}

/**
 * Names the spec fields that are missing on a component.
 *
 * Returns them qualified by product name, because "socket is missing" is not
 * actionable in a build with three parts that all have one.
 */
export function missingFields(
  component: BuildComponent,
  fields: (keyof NonNullable<BuildComponent["specs"]>)[]
): string[] {
  if (!component.specs) {
    return fields.map((field) => `${component.name}.${String(field)}`);
  }

  const specs = component.specs;

  return fields
    .filter((field) => specs[field] === null || specs[field] === undefined)
    .map((field) => `${component.name}.${String(field)}`);
}

/** A non-empty trimmed string, or null. Blank text is not data. */
export function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A usable number, or null.
 *
 * Zero is deliberately allowed through: a board with zero SATA ports is a fact
 * about the board, and collapsing it into "unknown" would turn a real
 * incompatibility into a shrug.
 */
export function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Sockets a part mounts on.
 *
 * A processor or a board has exactly one. A cooler ships brackets for several,
 * so the column holds them comma-separated and this is where that convention
 * is decoded — once, rather than in each rule that cares.
 */
export function socketList(value: string | null | undefined): string[] {
  const raw = text(value);

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
}

/** Total connectors of each pin count, keyed by pins. */
export function connectorTotals(
  connectors: PciePowerConnector[] | null | undefined
): Map<number, number> {
  const totals = new Map<number, number>();

  if (!connectors) {
    return totals;
  }

  for (const connector of connectors) {
    const pins = num(connector?.pins);
    const count = num(connector?.count);

    if (pins === null || count === null || count <= 0) {
      continue;
    }

    totals.set(pins, (totals.get(pins) ?? 0) + count);
  }

  return totals;
}

/** Round up to the next multiple — power supplies are sold in 50W steps. */
export function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
