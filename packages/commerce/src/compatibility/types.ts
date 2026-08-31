import type { CategorySlug, PciePowerConnector } from "@workspace/db";

/**
 * The four states §4 asks for, and nothing else.
 *
 * `insufficient_data` is the one that earns its keep. A rule whose inputs are
 * null must say so rather than fall back on `compatible`, because "we could not
 * check" and "we checked and it is fine" are different answers and only one of
 * them is safe to act on.
 *
 * `requires_verification` is for a check that passed too narrowly to trust —
 * a card 3mm inside a case's quoted clearance, a supply with headroom but not
 * much. The build is probably fine; the customer should measure.
 */
export type CompatibilityStatus =
  | "compatible"
  | "requires_verification"
  | "incompatible"
  | "insufficient_data";

/**
 * How bad a finding is, which is a separate question from what it is.
 *
 * Only `blocking` stops a checkout. `insufficient_data` is deliberately a
 * warning: refusing to sell an imported card because its distributor publishes
 * no dimensions would be worse than telling the customer to measure. What §4
 * forbids is staying quiet about it.
 */
export type IssueSeverity = "blocking" | "warning" | "info";

export interface CompatibilityIssue {
  /** Products the finding is about, so a client can highlight them. */
  affectedProductIds: string[];
  /** Human-readable, and shown to the customer verbatim. */
  message: string;
  /** Which spec columns were null, when the status is `insufficient_data`. */
  missingSpecs?: string[];
  /** Stable identifier, e.g. `cpu_motherboard_socket`. */
  rule: string;
  severity: IssueSeverity;
  status: CompatibilityStatus;
  /** What to do about it, when there is something concrete to say. */
  suggestion?: string;
}

export interface BuildValidation {
  /** False when any issue is `blocking`. */
  canCheckout: boolean;
  /** Watts the selected parts are expected to draw under load. */
  estimatedWattage: number;
  /** Every check that could be evaluated, passing ones included. */
  issues: CompatibilityIssue[];
  /** Supply size to aim for, in watts. */
  recommendedPsuWattage: number;
  /** How many units occupy each build slot. */
  slotsUsed: Record<string, number>;
  /** The worst status among the issues. */
  status: CompatibilityStatus;
}

/**
 * The spec fields a rule may read.
 *
 * A structural subset of the `product_specs` row — no ids, no timestamps — so
 * the engine can be handed a literal in a test as easily as a database row.
 * Every field is nullable because every column is.
 */
export interface ComponentSpecs {
  chipset?: string | null;
  extra?: Record<string, unknown> | null;
  formFactor?: string | null;
  heightMm?: number | null;
  lengthMm?: number | null;
  m2Slots?: number | null;
  maxCoolerHeightMm?: number | null;
  maxGpuLengthMm?: number | null;
  memoryCapacityGb?: number | null;
  memorySlots?: number | null;
  memorySpeedMhz?: number | null;
  memoryType?: string | null;
  pciePowerConnectors?: PciePowerConnector[] | null;
  psuWattage?: number | null;
  recommendedPsuWatts?: number | null;
  sataPorts?: number | null;
  socket?: string | null;
  storageInterface?: string | null;
  tdpWatts?: number | null;
  widthMm?: number | null;
}

/**
 * One selected part.
 *
 * `specs` is null when the product has no spec row at all, which is a
 * different fact from a row whose columns happen to be null — the first means
 * nobody has entered specifications, the second means these particular ones
 * are unknown. Both end at `insufficient_data`; the message differs.
 */
export interface BuildComponent {
  categorySlug: CategorySlug;
  /** Used in messages, so the customer reads a product name and not a UUID. */
  name: string;
  productId: string;
  quantity: number;
  specs: ComponentSpecs | null;
}

/** A rule is a pure function over the selected parts. No database, no model. */
export type CompatibilityRule = (
  components: BuildComponent[]
) => CompatibilityIssue[];
