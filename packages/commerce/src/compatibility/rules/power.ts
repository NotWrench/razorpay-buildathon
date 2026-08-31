import type { CategorySlug } from "@workspace/db/taxonomy";
import {
  componentsOf,
  connectorTotals,
  issue,
  missingFields,
  num,
  roundUpTo,
} from "../helpers";
import type { BuildComponent, CompatibilityIssue } from "../types";

/**
 * Power: does the supply have the watts, and does it have the cables.
 *
 * Two independent failures that both end with a machine that will not boot,
 * and the second is the one people miss — a 750W supply with two PCIe
 * connectors cannot run a card that needs three, however much headroom the
 * wattage suggests.
 */

/** The margin a supply should keep over the expected draw. */
export const PSU_HEADROOM_FACTOR = 1.3;

/**
 * Draw that is not attributable to a processor or a card, in watts.
 *
 * A board, its chipset, the drives and the fans pull a real but small and
 * fairly predictable amount. Modelling each part's idle draw would be false
 * precision on specs the catalog does not carry, so it is a stated allowance
 * that the estimate can be explained in terms of.
 */
export const BASE_SYSTEM_WATTS = 60;
const STORAGE_WATTS_EACH = 8;
const FAN_WATTS_EACH = 3;

/** Only these categories report a draw. Everything else is in the allowance. */
const DRAWING_CATEGORIES: CategorySlug[] = ["cpu", "gpu"];

export interface WattageEstimate {
  /** Components whose `tdpWatts` is null, so the total is a floor not a total. */
  missingSpecs: string[];
  /** Expected draw under load, in watts. */
  watts: number;
}

/**
 * What the selected parts are expected to draw.
 *
 * A cooler's `tdpWatts` is the heat it can *remove*, not power it consumes, so
 * coolers are excluded — adding a 350W radiator to the system draw would be a
 * plain unit error and would sell everyone a supply twice the size they need.
 */
export function estimateWattage(components: BuildComponent[]): WattageEstimate {
  const missingSpecs: string[] = [];
  let watts = BASE_SYSTEM_WATTS;

  for (const component of components) {
    if (DRAWING_CATEGORIES.includes(component.categorySlug)) {
      const tdp = num(component.specs?.tdpWatts);

      if (tdp === null) {
        missingSpecs.push(...missingFields(component, ["tdpWatts"]));
        continue;
      }

      watts += tdp * component.quantity;
      continue;
    }

    if (component.categorySlug === "storage") {
      watts += STORAGE_WATTS_EACH * component.quantity;
    }

    if (component.categorySlug === "fan") {
      watts += FAN_WATTS_EACH * component.quantity;
    }
  }

  return { missingSpecs, watts };
}

/**
 * The supply size to aim for.
 *
 * The larger of the headroom-adjusted estimate and the highest vendor
 * recommendation among the selected cards — a card maker's figure accounts for
 * transient spikes that a TDP sum does not, so it is a floor rather than a
 * second opinion. Rounded up to how supplies are actually sold.
 */
export function recommendPsuWattage(components: BuildComponent[]): number {
  const { watts } = estimateWattage(components);

  const vendorFloor = componentsOf(components, "gpu").reduce(
    (highest, card) =>
      Math.max(highest, num(card.specs?.recommendedPsuWatts) ?? 0),
    0
  );

  return roundUpTo(Math.max(watts * PSU_HEADROOM_FACTOR, vendorFloor), 50);
}

export function psuWattageHeadroom(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const supplies = componentsOf(components, "psu");

  if (supplies.length === 0) {
    return [];
  }

  const estimate = estimateWattage(components);
  const target = Math.ceil(estimate.watts * PSU_HEADROOM_FACTOR);
  const issues: CompatibilityIssue[] = [];

  for (const supply of supplies) {
    const wattage = num(supply.specs?.psuWattage);
    const affectedProductIds = [
      supply.productId,
      ...components
        .filter((component) =>
          DRAWING_CATEGORIES.includes(component.categorySlug)
        )
        .map((component) => component.productId),
    ];

    if (wattage === null || estimate.missingSpecs.length > 0) {
      issues.push(
        issue({
          affectedProductIds,
          message:
            wattage === null
              ? `${supply.name} does not publish a wattage, so headroom cannot be checked.`
              : `Power draw is not published for every part here, so the ${wattage}W of ${supply.name} cannot be checked against it.`,
          missingSpecs: [
            ...missingFields(supply, ["psuWattage"]),
            ...estimate.missingSpecs,
          ],
          rule: "psu_wattage_headroom",
          status: "insufficient_data",
          suggestion:
            "Check the draw of the missing parts against the supply before ordering.",
        })
      );
      continue;
    }

    if (wattage < estimate.watts) {
      issues.push(
        issue({
          affectedProductIds,
          message: `${supply.name} supplies ${wattage}W and these parts are expected to draw about ${estimate.watts}W under load.`,
          rule: "psu_wattage_headroom",
          status: "incompatible",
          suggestion: `Choose a supply of at least ${roundUpTo(target, 50)}W.`,
        })
      );
      continue;
    }

    if (wattage < target) {
      issues.push(
        issue({
          affectedProductIds,
          message: `${supply.name} supplies ${wattage}W against an expected draw of about ${estimate.watts}W. That works, but leaves less than the ${Math.round((PSU_HEADROOM_FACTOR - 1) * 100)}% margin usually kept for transient spikes.`,
          rule: "psu_wattage_headroom",
          status: "requires_verification",
          suggestion: `A ${roundUpTo(target, 50)}W supply would leave normal headroom.`,
        })
      );
      continue;
    }

    issues.push(
      issue({
        affectedProductIds,
        message: `${supply.name} supplies ${wattage}W against an expected draw of about ${estimate.watts}W.`,
        rule: "psu_wattage_headroom",
        status: "compatible",
      })
    );
  }

  return issues;
}

/**
 * Whether the supply has the cables the cards ask for.
 *
 * Both sides use the same `pciePowerConnectors` shape, read in opposite
 * directions: on a card it is what the card requires, on a supply what it
 * provides. Requirements across several cards are summed, because they draw
 * from the same supply.
 */
export function psuGpuConnectors(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const supplies = componentsOf(components, "psu");
  const cards = componentsOf(components, "gpu");

  if (supplies.length === 0 || cards.length === 0) {
    return [];
  }

  const issues: CompatibilityIssue[] = [];

  const cardsWithoutConnectors = cards.filter(
    (card) => !card.specs?.pciePowerConnectors
  );

  const required = new Map<number, number>();

  for (const card of cards) {
    for (const [pins, count] of connectorTotals(
      card.specs?.pciePowerConnectors
    )) {
      required.set(pins, (required.get(pins) ?? 0) + count * card.quantity);
    }
  }

  for (const supply of supplies) {
    const affectedProductIds = [
      supply.productId,
      ...cards.map((card) => card.productId),
    ];

    if (
      cardsWithoutConnectors.length > 0 ||
      !supply.specs?.pciePowerConnectors
    ) {
      issues.push(
        issue({
          affectedProductIds,
          message:
            "The PCIe power connectors are not published for every part here, so the cabling cannot be checked.",
          missingSpecs: [
            ...missingFields(supply, ["pciePowerConnectors"]),
            ...cardsWithoutConnectors.flatMap((card) =>
              missingFields(card, ["pciePowerConnectors"])
            ),
          ],
          rule: "psu_gpu_connectors",
          status: "insufficient_data",
          suggestion:
            "Check the card's connector layout against the supply's cable list before ordering.",
        })
      );
      continue;
    }

    const provided = connectorTotals(supply.specs.pciePowerConnectors);
    const shortfalls: string[] = [];

    for (const [pins, count] of required) {
      const available = provided.get(pins) ?? 0;

      if (available < count) {
        shortfalls.push(`${count} x ${pins}-pin needed, ${available} provided`);
      }
    }

    const satisfied = shortfalls.length === 0;

    issues.push(
      issue({
        affectedProductIds,
        message: satisfied
          ? `${supply.name} provides the PCIe power connectors the selected card needs.`
          : `${supply.name} does not have the PCIe power connectors for this card: ${shortfalls.join("; ")}.`,
        rule: "psu_gpu_connectors",
        status: satisfied ? "compatible" : "incompatible",
        suggestion: satisfied
          ? undefined
          : "Choose a supply with enough PCIe cables. Adapters that split one cable into two are not a substitute at this power level.",
      })
    );
  }

  return issues;
}
