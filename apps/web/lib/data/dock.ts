import { formatPaise } from "@workspace/ui/lib/money";
import { getCart } from "./cart";
import { getProduct, getProducts, isUuid, searchQuery } from "./product";
import type { ProductSummary, SpecRow } from "./types";

/**
 * The corner assistant's three answers, over the real store.
 *
 * The dock does three jobs — what is this, compare two parts, show my list —
 * and refuses everything else in one line. That narrowness is the design, not
 * a shortfall: a panel that quietly attempts everything is one you cannot
 * trust with anything, and the handoff to the full assistant is one press
 * away.
 *
 * Which is also why this is a set of queries rather than a model call. Every
 * sentence below is a restatement of a row — the specification, the stock
 * word, the basket total — so the panel cannot say something the catalogue
 * does not. Open-ended questions are what `/api/agent/chat` is for, and the
 * refusal points there.
 */

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
  text: string;
  tool?: DockTool;
}

const ASKS_FOR_LIST = /(my list|my build|budget|total|cart)/;
const ASKS_TO_COMPARE = /(compare|versus|vs\b|difference)/;
const ASKS_ABOUT_THIS = /(what is|what's|tell me|any good|specs|about)/;
const ASKS_TO_ACT = /(add|buy|order|checkout|remove|change|swap|build me|pay)/;

const STOCK_PHRASE = {
  in_stock: "in stock",
  low_stock: "low on stock",
  out_of_stock: "out of stock",
} as const;

/** "a, b and c" — an Oxford-free list, because these are read aloud as prose. */
function sentenceList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function specValue(item: ProductSummary, label: string): string {
  return (
    item.keySpecs.find((row: SpecRow) => row.label === label)?.value ?? "—"
  );
}

/** One line, two lines. A count that says "1 lines" reads as a bug. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

async function listReply(): Promise<DockReply> {
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return {
      intent: "list",
      result: { kind: "none" },
      text: "Nothing on your list yet. Add a part and I can total it up.",
      tool: {
        args: { scope: "cart" },
        label: "read your list",
        result: plural(0, "line"),
      },
    };
  }

  const items = cart.lines.reduce((total, line) => total + line.quantity, 0);

  return {
    intent: "list",
    result: {
      kind: "list",
      lines: cart.lines.map((line) => ({
        product: line.product,
        quantity: line.quantity,
      })),
      totalPaise: cart.totalPaise,
    },
    text: `${plural(cart.lines.length, "line")}, ${plural(items, "item")}, ${formatPaise(cart.totalPaise)}. Here is what is on it.`,
    tool: {
      args: { scope: "cart" },
      label: "read your list",
      result: plural(cart.lines.length, "line"),
    },
  };
}

function infoReply(item: ProductSummary): DockReply {
  const specs = item.keySpecs
    .map((row) => `${row.label} ${row.value}`)
    .join(", ");

  return {
    intent: "info",
    result: { kind: "product", product: item },
    text: specs
      ? `${item.name}: ${specs}. It is ${STOCK_PHRASE[item.stock]} at ${formatPaise(item.pricePaise)}.`
      : `${item.name} is ${STOCK_PHRASE[item.stock]} at ${formatPaise(item.pricePaise)}. No specifications have been entered for it yet.`,
    tool: {
      args: { productId: item.id },
      label: "read the catalogue",
      result: "1 product",
    },
  };
}

const COMPARE_ROWS = 4;

function compareReply(left: ProductSummary, right: ProductSummary): DockReply {
  const labels = [
    ...new Set([
      ...left.keySpecs.map((row) => row.label),
      ...right.keySpecs.map((row) => row.label),
    ]),
  ];

  const rows = [
    {
      label: "Price",
      left: formatPaise(left.pricePaise),
      right: formatPaise(right.pricePaise),
    },
    ...labels.map((label) => ({
      label,
      left: specValue(left, label),
      right: specValue(right, label),
    })),
  ];

  const differing = rows
    .slice(1)
    .filter((row) => row.left !== row.right)
    .map((row) => row.label);

  return {
    intent: "compare",
    result: {
      kind: "comparison",
      left,
      right,
      rows: rows.slice(0, COMPARE_ROWS),
    },
    text: differing.length
      ? `The ${left.name} and the ${right.name} differ on ${sentenceList(differing)}. Everything else on the card is the same.`
      : `The ${left.name} and the ${right.name} state the same specifications. Price is the only difference the catalogue records.`,
    tool: {
      args: { a: left.id, b: right.id },
      label: "compared two products",
      result: plural(rows.length, "row"),
      rules: rows.length,
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
 * What the dock says. Deterministic, and deliberately narrow.
 *
 * Asking it to *do* something is out of scope whatever else the sentence
 * mentions: "add this to my cart" contains the word cart, and answering it
 * with a read-only list would look like the request had been carried out.
 */
export async function dockReply(
  prompt: string,
  productId?: string
): Promise<DockReply> {
  const asked = prompt.toLowerCase();
  const inContext =
    productId && isUuid(productId) ? await getProduct(productId) : null;

  if (ASKS_TO_ACT.test(asked)) {
    return beyondReply();
  }

  if (ASKS_FOR_LIST.test(asked)) {
    return await listReply();
  }

  if (ASKS_TO_COMPARE.test(asked)) {
    return await comparisonFor(inContext, asked);
  }

  if (inContext && (ASKS_ABOUT_THIS.test(asked) || asked.trim().length > 0)) {
    return infoReply(inContext);
  }

  return beyondReply();
}

/**
 * Two parts to put side by side.
 *
 * The one on screen against its nearest alternative, which is the comparison
 * the shopper is actually in the middle of. Without a product in context the
 * words of the question are searched instead, and if that turns up fewer than
 * two the panel says it cannot rather than picking a pair at random.
 */
async function comparisonFor(
  inContext: ProductSummary | null,
  asked: string
): Promise<DockReply> {
  if (inContext) {
    const [alternative] = (
      await getProducts({ category: inContext.category, limit: 6 })
    ).filter((candidate) => candidate.id !== inContext.id);

    return alternative
      ? compareReply(inContext, alternative)
      : {
          intent: "compare",
          result: { kind: "product", product: inContext },
          text: `There is nothing else in ${inContext.category} to compare the ${inContext.name} against.`,
        };
  }

  const found = await searchQuery(asked.replace(ASKS_TO_COMPARE, "").trim());
  const [left, right] = found.products;

  return left && right ? compareReply(left, right) : beyondReply();
}

/**
 * The starter rows, which depend on what the page can see.
 *
 * "What is this?" needs an actual product, not merely a label — a category
 * page has a name but nothing singular for the question to refer to.
 */
export async function dockStarters(hasProduct: boolean) {
  const cart = await getCart();
  const items = cart.lines.reduce((total, line) => total + line.quantity, 0);

  return [
    ...(hasProduct
      ? [{ id: "info", label: "What is this?", value: "What is this?" }]
      : []),
    {
      id: "compare",
      label: "Compare with an alternative",
      value: "Compare with an alternative",
    },
    {
      id: "list",
      label: "My list",
      meta:
        items > 0
          ? `${items} items · ${formatPaise(cart.totalPaise)}`
          : "empty",
      value: "Show me my list",
    },
  ];
}
