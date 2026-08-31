import { componentsOf, issue, missingFields, num, text } from "../helpers";
import type { BuildComponent, CompatibilityIssue } from "../types";

/**
 * Rules about the platform: what physically mates with what on the board.
 *
 * These are the cheapest mistakes to make and the most expensive to discover,
 * because a wrong socket or the wrong memory generation is only obvious once
 * the parts are out of their boxes and no longer returnable.
 */

/**
 * Which board sizes a case accepts.
 *
 * A case is specified by the largest board it takes, and larger cases take
 * smaller boards — an ATX case fits a mini-ITX board with room to spare. The
 * relation is a containment hierarchy, not equality, so it is written out
 * rather than compared with `===`.
 */
const CASE_ACCEPTS: Record<string, string[]> = {
  ATX: ["ATX", "MATX", "ITX"],
  "E-ATX": ["E-ATX", "ATX", "MATX", "ITX"],
  ITX: ["ITX"],
  MATX: ["MATX", "ITX"],
};

function normaliseFormFactor(value: string | null): string | null {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  return raw
    .toUpperCase()
    .replace(/[\s_-]+/g, "")
    .replace("MICROATX", "MATX")
    .replace("MINIITX", "ITX")
    .replace("EATX", "E-ATX");
}

export function cpuMotherboardSocket(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const cpus = componentsOf(components, "cpu");
  const boards = componentsOf(components, "motherboard");
  const issues: CompatibilityIssue[] = [];

  for (const cpu of cpus) {
    for (const board of boards) {
      const cpuSocket = text(cpu.specs?.socket);
      const boardSocket = text(board.specs?.socket);
      const affectedProductIds = [cpu.productId, board.productId];

      if (!(cpuSocket && boardSocket)) {
        issues.push(
          issue({
            affectedProductIds,
            message: `The socket is not published for ${cpuSocket ? board.name : cpu.name}, so this pairing cannot be confirmed.`,
            missingSpecs: [
              ...missingFields(cpu, ["socket"]),
              ...missingFields(board, ["socket"]),
            ],
            rule: "cpu_motherboard_socket",
            status: "insufficient_data",
            suggestion:
              "Check the socket on both the processor and the board before ordering.",
          })
        );
        continue;
      }

      const matches = cpuSocket.toUpperCase() === boardSocket.toUpperCase();

      issues.push(
        issue({
          affectedProductIds,
          message: matches
            ? `${cpu.name} and ${board.name} are both ${cpuSocket}.`
            : `${cpu.name} is ${cpuSocket} and ${board.name} is ${boardSocket}. A processor only fits its own socket.`,
          rule: "cpu_motherboard_socket",
          status: matches ? "compatible" : "incompatible",
          suggestion: matches
            ? undefined
            : `Choose a ${cpuSocket} motherboard, or a ${boardSocket} processor.`,
        })
      );
    }
  }

  return issues;
}

export function motherboardRamType(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const boards = componentsOf(components, "motherboard");
  const kits = componentsOf(components, "ram");
  const issues: CompatibilityIssue[] = [];

  for (const board of boards) {
    for (const kit of kits) {
      const boardType = text(board.specs?.memoryType);
      const kitType = text(kit.specs?.memoryType);
      const affectedProductIds = [board.productId, kit.productId];

      if (!(boardType && kitType)) {
        issues.push(
          issue({
            affectedProductIds,
            message: `The memory generation is not published for ${boardType ? kit.name : board.name}, so this pairing cannot be confirmed.`,
            missingSpecs: [
              ...missingFields(board, ["memoryType"]),
              ...missingFields(kit, ["memoryType"]),
            ],
            rule: "motherboard_ram_type",
            status: "insufficient_data",
          })
        );
        continue;
      }

      const matches = boardType.toUpperCase() === kitType.toUpperCase();

      issues.push(
        issue({
          affectedProductIds,
          message: matches
            ? `${kit.name} is ${kitType}, which ${board.name} takes.`
            : `${board.name} takes ${boardType} and ${kit.name} is ${kitType}. The two generations are keyed differently and will not seat.`,
          rule: "motherboard_ram_type",
          status: matches ? "compatible" : "incompatible",
          suggestion: matches ? undefined : `Choose a ${boardType} memory kit.`,
        })
      );
    }
  }

  return issues;
}

export function motherboardRamSlots(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const boards = componentsOf(components, "motherboard");
  const kits = componentsOf(components, "ram");

  if (kits.length === 0) {
    return [];
  }

  const issues: CompatibilityIssue[] = [];

  for (const board of boards) {
    const available = num(board.specs?.memorySlots);
    const kitsWithoutCounts = kits.filter(
      (kit) => num(kit.specs?.memorySlots) === null
    );
    const affectedProductIds = [
      board.productId,
      ...kits.map((kit) => kit.productId),
    ];

    if (available === null || kitsWithoutCounts.length > 0) {
      issues.push(
        issue({
          affectedProductIds,
          message:
            "The number of memory slots is not published for every part here, so the sticks cannot be counted against the board.",
          missingSpecs: [
            ...missingFields(board, ["memorySlots"]),
            ...kitsWithoutCounts.flatMap((kit) =>
              missingFields(kit, ["memorySlots"])
            ),
          ],
          rule: "motherboard_ram_slots",
          status: "insufficient_data",
        })
      );
      continue;
    }

    const required = kits.reduce(
      (total, kit) => total + (num(kit.specs?.memorySlots) ?? 0) * kit.quantity,
      0
    );
    const fits = required <= available;

    issues.push(
      issue({
        affectedProductIds,
        message: fits
          ? `${required} of ${board.name}'s ${available} memory slots are used.`
          : `The selected memory needs ${required} slots and ${board.name} has ${available}.`,
        rule: "motherboard_ram_slots",
        status: fits ? "compatible" : "incompatible",
        suggestion: fits
          ? undefined
          : "Use a kit with fewer, larger sticks, or a board with more slots.",
      })
    );
  }

  return issues;
}

export function motherboardCaseFormFactor(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const boards = componentsOf(components, "motherboard");
  const cases = componentsOf(components, "case");
  const issues: CompatibilityIssue[] = [];

  for (const board of boards) {
    for (const enclosure of cases) {
      const boardForm = normaliseFormFactor(board.specs?.formFactor ?? null);
      const caseForm = normaliseFormFactor(enclosure.specs?.formFactor ?? null);
      const affectedProductIds = [board.productId, enclosure.productId];

      if (!(boardForm && caseForm)) {
        issues.push(
          issue({
            affectedProductIds,
            message: `The form factor is not published for ${boardForm ? enclosure.name : board.name}, so the fit cannot be confirmed.`,
            missingSpecs: [
              ...missingFields(board, ["formFactor"]),
              ...missingFields(enclosure, ["formFactor"]),
            ],
            rule: "motherboard_case_form_factor",
            status: "insufficient_data",
          })
        );
        continue;
      }

      const accepted = CASE_ACCEPTS[caseForm];

      if (!accepted) {
        issues.push(
          issue({
            affectedProductIds,
            message: `${enclosure.name} lists an unrecognised form factor (${caseForm}), so the fit cannot be confirmed.`,
            missingSpecs: [`${enclosure.name}.formFactor`],
            rule: "motherboard_case_form_factor",
            status: "insufficient_data",
          })
        );
        continue;
      }

      const fits = accepted.includes(boardForm);

      issues.push(
        issue({
          affectedProductIds,
          message: fits
            ? `${enclosure.name} takes ${boardForm} boards.`
            : `${board.name} is ${boardForm} and ${enclosure.name} only takes ${accepted.join(", ")}.`,
          rule: "motherboard_case_form_factor",
          status: fits ? "compatible" : "incompatible",
          suggestion: fits
            ? undefined
            : `Choose a case that takes ${boardForm}, or a smaller board.`,
        })
      );
    }
  }

  return issues;
}
