/**
 * A local, canned chat for the dock.
 *
 * The dock does three jobs — what is this, compare two things, show me my
 * list — so the mock answers exactly those three and refuses everything else
 * in one line. That refusal is not a placeholder: knowing where a surface
 * stops is most of what makes it trustworthy, and the handoff is the design.
 */

import { MOCK_PRODUCTS_BY_ID } from "./products";
import type { ProductSummary, SpecRow } from "./types";

export type DockIntent = "info" | "compare" | "list" | "beyond";

export interface DockTool {
  /** The arguments, as the agent would have sent them. */
  args: Record<string, string | number>;
  label: string;
  result: string;
  /** How many rules the engine ran, when it ran any. */
  rules?: number;
}

export type DockResult =
  | { kind: "none" }
  | { kind: "product"; product: ProductSummary }
  | {
      kind: "comparison";
      left: ProductSummary;
      right: ProductSummary;
      rows: { label: string; left: string; right: string }[];
    }
  | {
      kind: "list";
      lines: { product: ProductSummary; quantity: number }[];
      totalPaise: number;
    };

export interface DockReply {
  intent: DockIntent;
  result: DockResult;
  /** The answer, already split the way it will be streamed. */
  text: string;
  tool?: DockTool;
}

/** The list the dock can show. Read-only — editing lives on the full page. */
const LIST_IDS: [string, number][] = [
  ["cpu-1", 1],
  ["motherboard-2", 1],
  ["ram-1", 1],
  ["gpu-1", 1],
  ["psu-1", 1],
  ["gpu-3", 2],
  ["peripheral-1", 1],
];

const ASKS_FOR_LIST = /(my list|my build|budget|total|cart)/;
const ASKS_TO_COMPARE = /(compare|versus|vs\b|difference)/;
const ASKS_ABOUT_THIS = /(what is|what's|tell me|any good|specs|about)/;
const ASKS_TO_ACT = /(add|buy|order|checkout|remove|change|swap|build me|pay)/;

const STOCK_PHRASE = {
  in_stock: "in stock",
  low_stock: "low on stock",
  out_of_stock: "out of stock",
} as const;

function product(id: string): ProductSummary {
  const found = MOCK_PRODUCTS_BY_ID.get(id);

  if (!found) {
    throw new Error(`Mock chat references an unknown product: ${id}`);
  }

  return found;
}

function specValue(item: ProductSummary, label: string): string {
  return (
    item.keySpecs.find((row: SpecRow) => row.label === label)?.value ?? "—"
  );
}

function listReply(): DockReply {
  const lines = LIST_IDS.map(([id, quantity]) => ({
    product: product(id),
    quantity,
  }));

  const totalPaise = lines.reduce(
    (total, line) => total + line.product.pricePaise * line.quantity,
    0
  );

  return {
    intent: "list",
    result: { kind: "list", lines, totalPaise },
    text: `Seven lines, ${lines.reduce((n, l) => n + l.quantity, 0)} items. Here is what is on it and what it comes to.`,
    tool: {
      args: { scope: "cart" },
      label: "read your list",
      result: `${lines.length} lines`,
    },
  };
}

function infoReply(item: ProductSummary): DockReply {
  return {
    intent: "info",
    result: { kind: "product", product: item },
    text: `${item.name}: ${item.keySpecs
      .map((row) => `${row.label.toLowerCase()} ${row.value}`)
      .join(", ")}. It is ${STOCK_PHRASE[item.stock]} at the listed price.`,
    tool: {
      args: { productId: item.id },
      label: "read the catalogue",
      result: "1 product",
    },
  };
}

function compareReply(left: ProductSummary, right: ProductSummary): DockReply {
  const labels = left.keySpecs.map((row) => row.label);
  const rows = labels.map((label) => ({
    label,
    left: specValue(left, label),
    right: specValue(right, label),
  }));

  rows.unshift({
    label: "Price",
    left: `₹${(left.pricePaise / 100).toLocaleString("en-IN")}`,
    right: `₹${(right.pricePaise / 100).toLocaleString("en-IN")}`,
  });

  return {
    intent: "compare",
    result: { kind: "comparison", left, right, rows: rows.slice(0, 4) },
    text: `The ${left.name} and the ${right.name} differ on memory and board power. Everything else on the card is close enough not to decide it.`,
    tool: {
      args: { a: left.id, b: right.id },
      label: "compared two products",
      result: `${rows.length} rows`,
      rules: 6,
    },
  };
}

function beyondReply(): DockReply {
  return {
    intent: "beyond",
    result: { kind: "none" },
    text: "That is past what I can do from here — this panel only answers questions about what is on screen, compares two parts, and shows your list. The full assistant can build and change one.",
  };
}

/**
 * What the dock would say. Deterministic, and deliberately narrow.
 */
export function dockReply(prompt: string, productId?: string): DockReply {
  const asked = prompt.toLowerCase();
  const inContext = productId ? MOCK_PRODUCTS_BY_ID.get(productId) : undefined;

  /*
   * Asking it to *do* something is out of scope whatever else the sentence
   * mentions. "Add this to my cart" contains the word cart, and answering it
   * with a read-only list would look like the request had been carried out.
   */
  if (ASKS_TO_ACT.test(asked)) {
    return beyondReply();
  }

  if (ASKS_FOR_LIST.test(asked)) {
    return listReply();
  }

  if (ASKS_TO_COMPARE.test(asked)) {
    const left = inContext ?? product("gpu-1");
    const right = product(left.id === "gpu-2" ? "gpu-1" : "gpu-2");

    return compareReply(left, right);
  }

  if (inContext && ASKS_ABOUT_THIS.test(asked)) {
    return infoReply(inContext);
  }

  if (inContext && asked.trim().length > 0) {
    return infoReply(inContext);
  }

  return beyondReply();
}

/**
 * The starter rows, which depend on what the page can see.
 *
 * "What is this?" needs an actual product, not merely a label — a category
 * page has a name but nothing singular for the question to refer to.
 */
export function dockStarters(hasProduct: boolean) {
  const lines = LIST_IDS.reduce((n, [, quantity]) => n + quantity, 0);
  const total = LIST_IDS.reduce(
    (sum, [id, quantity]) => sum + product(id).pricePaise * quantity,
    0
  );

  return [
    ...(hasProduct
      ? [{ id: "info", label: "What is this?", value: "What is this?" }]
      : []),
    {
      id: "compare",
      label: "Compare with another card",
      value: "Compare with another card",
    },
    {
      id: "list",
      label: "My list",
      meta: `${lines} items · ₹${(total / 100).toLocaleString("en-IN")}`,
      value: "Show me my list",
    },
  ];
}
