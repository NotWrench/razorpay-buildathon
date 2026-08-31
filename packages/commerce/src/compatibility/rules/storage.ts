import { componentsOf, issue, missingFields, num, text } from "../helpers";
import type { BuildComponent, CompatibilityIssue } from "../types";

/**
 * Whether the board has somewhere to plug the drives in.
 *
 * The interface, not the capacity, is what constrains a build: an M.2 drive
 * needs an M.2 slot and a SATA drive needs a SATA port, and a board that has
 * run out of one usually still has the other. That is why the rule counts each
 * interface separately rather than totalling the drives.
 */

type Interface = "m2" | "sata";

function classify(value: string | null | undefined): Interface | null {
  const raw = text(value)?.toUpperCase();

  if (!raw) {
    return null;
  }

  if (raw.includes("M.2") || raw.includes("NVME")) {
    return "m2";
  }

  return raw.includes("SATA") ? "sata" : null;
}

export function storageInterfaceSlots(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const boards = componentsOf(components, "motherboard");
  const drives = componentsOf(components, "storage");

  if (drives.length === 0) {
    return [];
  }

  const issues: CompatibilityIssue[] = [];

  const unclassified = drives.filter(
    (drive) => classify(drive.specs?.storageInterface) === null
  );

  const needed: Record<Interface, number> = { m2: 0, sata: 0 };

  for (const drive of drives) {
    const kind = classify(drive.specs?.storageInterface);

    if (kind) {
      needed[kind] += drive.quantity;
    }
  }

  for (const board of boards) {
    const m2Slots = num(board.specs?.m2Slots);
    const sataPorts = num(board.specs?.sataPorts);
    const affectedProductIds = [
      board.productId,
      ...drives.map((drive) => drive.productId),
    ];

    if (unclassified.length > 0 || m2Slots === null || sataPorts === null) {
      issues.push(
        issue({
          affectedProductIds,
          message:
            "The drive interfaces or the board's slot counts are not published, so the drives cannot be counted against the board.",
          missingSpecs: [
            ...missingFields(board, ["m2Slots", "sataPorts"]),
            ...unclassified.flatMap((drive) =>
              missingFields(drive, ["storageInterface"])
            ),
          ],
          rule: "storage_interface_slots",
          status: "insufficient_data",
        })
      );
      continue;
    }

    const shortfalls: string[] = [];

    if (needed.m2 > m2Slots) {
      shortfalls.push(
        `${needed.m2} M.2 drives against ${m2Slots} M.2 slot${m2Slots === 1 ? "" : "s"}`
      );
    }

    if (needed.sata > sataPorts) {
      shortfalls.push(
        `${needed.sata} SATA drives against ${sataPorts} SATA port${sataPorts === 1 ? "" : "s"}`
      );
    }

    const fits = shortfalls.length === 0;

    issues.push(
      issue({
        affectedProductIds,
        message: fits
          ? `${board.name} has room for the selected drives: ${needed.m2}/${m2Slots} M.2, ${needed.sata}/${sataPorts} SATA.`
          : `${board.name} does not have enough connectors: ${shortfalls.join("; ")}.`,
        rule: "storage_interface_slots",
        status: fits ? "compatible" : "incompatible",
        suggestion: fits
          ? undefined
          : "Swap a drive for the other interface, or choose a board with more connectors.",
      })
    );
  }

  return issues;
}
