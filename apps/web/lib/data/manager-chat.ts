import { formatPaise } from "@workspace/ui/lib/money";
import { getManagerSummary } from "./manager";
import type { Finding } from "./types";

/**
 * The manager's follow-up, answered from the store's own numbers.
 *
 * It replies with the material the summary is made of — a table or a finding
 * row — because an operations agent that answers "how did storage do" in
 * prose is asking to be re-read rather than read.
 *
 * And it answers from queries rather than from a model, for the reason §10
 * gives: an operational claim a merchant cannot check is one they will learn
 * to ignore. Every cell below is a figure the summary above it already shows.
 * Open-ended reasoning is `/api/agent/merchant`, which the merchant assistant
 * on `/dashboard/assistant` streams.
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

export async function managerReply(
  question: string,
  rangeId?: string
): Promise<ManagerReply> {
  const summary = await getManagerSummary(rangeId);

  if (ASKS_TO_EXECUTE.test(question)) {
    return {
      result: { kind: "none" },
      text: "I draft, you approve. I can prepare the reorder and put it in your drafts, but nothing leaves this room without you pressing the button.",
    };
  }

  if (ASKS_ABOUT_SALES.test(question)) {
    if (summary.sellingWell.length === 0) {
      return {
        result: { kind: "none" },
        text: `Nothing sold in ${summary.range.label}, so there is no ranking to show.`,
      };
    }

    return {
      result: {
        kind: "table",
        table: {
          columns: ["Product", "Units", "Revenue"],
          numeric: [1, 2],
          rows: summary.sellingWell.map((row) => [
            row.product.name,
            String(row.units),
            formatPaise(row.units * row.product.pricePaise),
          ]),
          title: `Top sellers · ${summary.range.label}`,
        },
      },
      text: `${summary.sellingWell.length} products carried the window. Here they are with what they brought in.`,
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
      text:
        stockFindings.length === 1
          ? "One line is close enough to matter."
          : `${stockFindings.length} lines are close enough to matter.`,
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
