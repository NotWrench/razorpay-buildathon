import { managerSummaryFor } from "./manager";
import type { Finding } from "./types";

/**
 * A local, canned chat for the manager.
 *
 * It answers with the same material the summary is made of — a table or a
 * finding row — because an operations agent that replies in prose to "how did
 * storage do" is asking to be re-read rather than read. Anything it cannot
 * answer from the numbers it already has, it says so in one line.
 *
 * Nothing here writes. Actions produce drafts, and the refusal says which.
 */

export interface ManagerTable {
  columns: string[];
  /** Which column indexes hold numbers. Those, and only those, are mono. */
  numeric: number[];
  /** Cells are pre-formatted; the component decides only which are mono. */
  rows: string[][];
  title: string;
}

export type ManagerResult =
  | { kind: "none" }
  | { kind: "table"; table: ManagerTable }
  | { kind: "findings"; findings: Finding[] };

export interface ManagerReply {
  result: ManagerResult;
  text: string;
}

const ASKS_TO_EXECUTE =
  /(place|execute|order it|reorder now|apply|publish|send it|do it)/i;
const ASKS_ABOUT_SALES = /(sales|selling|revenue|earnings|units|best)/i;
const ASKS_ABOUT_STOCK = /(stock|restock|reorder|inventory|out of)/i;
const ASKS_WHAT_TO_DO = /(what should|what would|recommend|advice|priorit)/i;

export function managerReply(question: string, rangeId?: string): ManagerReply {
  const summary = managerSummaryFor(rangeId);

  if (ASKS_TO_EXECUTE.test(question)) {
    return {
      result: { kind: "none" },
      text: "I draft, you approve. I can prepare the reorder and put it in your drafts, but nothing leaves this room without you pressing the button.",
    };
  }

  if (ASKS_ABOUT_SALES.test(question)) {
    return {
      result: {
        kind: "table",
        table: {
          columns: ["Product", "Units", "Revenue"],
          numeric: [1, 2],
          rows: summary.sellingWell.map((row) => [
            row.product.name,
            String(row.units),
            `₹${((row.units * row.product.pricePaise) / 100).toLocaleString("en-IN")}`,
          ]),
          title: `Top sellers · ${summary.range.label}`,
        },
      },
      text: "Three products carried the window. Here they are with what they brought in.",
    };
  }

  if (ASKS_ABOUT_STOCK.test(question)) {
    const stockFindings = summary.findings.filter(
      (finding) => finding.proposedAction?.kind === "reorder"
    );

    if (stockFindings.length === 0) {
      return {
        result: { kind: "none" },
        text: "Nothing is close enough to running out to be worth a reorder in this window.",
      };
    }

    return {
      result: { findings: stockFindings, kind: "findings" },
      text: "One line is close enough to matter.",
    };
  }

  if (ASKS_WHAT_TO_DO.test(question)) {
    if (summary.findings.length === 0) {
      return {
        result: { kind: "none" },
        text: "Nothing needs you this week. The numbers are where they were and no line is running out.",
      };
    }

    return {
      result: { findings: summary.findings, kind: "findings" },
      text: "In this order.",
    };
  }

  return {
    result: { kind: "none" },
    text: "I can only answer from the numbers on this page — sales, stock, and what I would do about either. Ask me one of those and I will show my working.",
  };
}
