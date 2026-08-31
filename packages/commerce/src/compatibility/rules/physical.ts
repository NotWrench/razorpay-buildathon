import {
  componentsOf,
  issue,
  missingFields,
  num,
  socketList,
} from "../helpers";
import type {
  BuildComponent,
  CompatibilityIssue,
  CompatibilityStatus,
} from "../types";

/**
 * Rules about whether the parts physically fit in the box.
 *
 * Manufacturers quote clearances optimistically — usually with the front fans
 * removed, and always without the cables that have to bend somewhere. A part
 * that clears by a couple of millimetres on paper is not a part that fits, so
 * the last few millimetres are reported as `requires_verification` rather than
 * waved through. The customer is being told to measure, not being stopped.
 */
const CLEARANCE_TOLERANCE_MM = 5;

function clearanceStatus(
  requiredMm: number,
  availableMm: number
): CompatibilityStatus {
  if (requiredMm > availableMm) {
    return "incompatible";
  }

  return availableMm - requiredMm < CLEARANCE_TOLERANCE_MM
    ? "requires_verification"
    : "compatible";
}

export function gpuCaseClearance(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const cards = componentsOf(components, "gpu");
  const cases = componentsOf(components, "case");
  const issues: CompatibilityIssue[] = [];

  for (const card of cards) {
    for (const enclosure of cases) {
      const cardLength = num(card.specs?.lengthMm);
      const clearance = num(enclosure.specs?.maxGpuLengthMm);
      const affectedProductIds = [card.productId, enclosure.productId];

      if (cardLength === null || clearance === null) {
        issues.push(
          issue({
            affectedProductIds,
            message: `${cardLength === null ? card.name : enclosure.name} does not publish the measurement needed to check whether ${card.name} fits ${enclosure.name}.`,
            missingSpecs: [
              ...missingFields(card, ["lengthMm"]),
              ...missingFields(enclosure, ["maxGpuLengthMm"]),
            ],
            rule: "gpu_case_clearance",
            status: "insufficient_data",
            suggestion:
              "Measure the card and the case before ordering, or choose a card with a published length.",
          })
        );
        continue;
      }

      const status = clearanceStatus(cardLength, clearance);
      const slack = clearance - cardLength;

      issues.push(
        issue({
          affectedProductIds,
          message:
            status === "incompatible"
              ? `${card.name} is ${cardLength}mm and ${enclosure.name} takes cards up to ${clearance}mm. It will not go in.`
              : `${card.name} is ${cardLength}mm in a ${clearance}mm case — ${slack}mm to spare.`,
          rule: "gpu_case_clearance",
          status,
          suggestion:
            // biome-ignore lint/nursery/noNestedTernary: three clearance outcomes, one message each
            status === "incompatible"
              ? `Choose a case taking at least ${cardLength}mm, or a shorter card.`
              : status === "requires_verification"
                ? "That is tight enough to check against the front fans and the cable bend before ordering."
                : undefined,
        })
      );
    }
  }

  return issues;
}

export function coolerCaseClearance(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const coolers = componentsOf(components, "cooler");
  const cases = componentsOf(components, "case");
  const issues: CompatibilityIssue[] = [];

  for (const cooler of coolers) {
    for (const enclosure of cases) {
      const height = num(cooler.specs?.heightMm);
      const clearance = num(enclosure.specs?.maxCoolerHeightMm);
      const affectedProductIds = [cooler.productId, enclosure.productId];

      if (height === null || clearance === null) {
        issues.push(
          issue({
            affectedProductIds,
            message: `${height === null ? cooler.name : enclosure.name} does not publish the measurement needed to check whether ${cooler.name} fits ${enclosure.name}.`,
            missingSpecs: [
              ...missingFields(cooler, ["heightMm"]),
              ...missingFields(enclosure, ["maxCoolerHeightMm"]),
            ],
            rule: "cooler_case_clearance",
            status: "insufficient_data",
          })
        );
        continue;
      }

      const status = clearanceStatus(height, clearance);
      const slack = clearance - height;

      issues.push(
        issue({
          affectedProductIds,
          message:
            status === "incompatible"
              ? `${cooler.name} is ${height}mm tall and ${enclosure.name} clears ${clearance}mm. The side panel will not close.`
              : `${cooler.name} is ${height}mm under a ${clearance}mm limit — ${slack}mm to spare.`,
          rule: "cooler_case_clearance",
          status,
          suggestion:
            status === "incompatible"
              ? `Choose a cooler under ${clearance}mm, or a taller case.`
              : undefined,
        })
      );
    }
  }

  return issues;
}

/**
 * Whether the cooler ships a bracket for the processor's socket.
 *
 * A cooler mounts on several sockets, so its `socket` column lists them
 * comma-separated. A bracket that is not in the box is not compatibility, even
 * where the vendor sells one separately — that is a second purchase, and the
 * suggestion says so.
 */
export function coolerCpuSocket(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const coolers = componentsOf(components, "cooler");
  const cpus = componentsOf(components, "cpu");
  const issues: CompatibilityIssue[] = [];

  for (const cooler of coolers) {
    for (const cpu of cpus) {
      const supported = socketList(cooler.specs?.socket);
      const cpuSocket = socketList(cpu.specs?.socket)[0] ?? null;
      const affectedProductIds = [cooler.productId, cpu.productId];

      if (supported.length === 0 || cpuSocket === null) {
        issues.push(
          issue({
            affectedProductIds,
            message: `The socket is not published for ${supported.length === 0 ? cooler.name : cpu.name}, so the mounting cannot be confirmed.`,
            missingSpecs: [
              ...missingFields(cooler, ["socket"]),
              ...missingFields(cpu, ["socket"]),
            ],
            rule: "cooler_cpu_socket",
            status: "insufficient_data",
          })
        );
        continue;
      }

      const mounts = supported.includes(cpuSocket);

      issues.push(
        issue({
          affectedProductIds,
          message: mounts
            ? `${cooler.name} mounts on ${cpuSocket}.`
            : `${cooler.name} ships brackets for ${supported.join(", ")}, and ${cpu.name} is ${cpuSocket}.`,
          rule: "cooler_cpu_socket",
          status: mounts ? "compatible" : "incompatible",
          suggestion: mounts
            ? undefined
            : `Choose a cooler listing ${cpuSocket}, or source a ${cpuSocket} mounting kit separately.`,
        })
      );
    }
  }

  return issues;
}
