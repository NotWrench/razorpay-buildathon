import type { BuildComponent } from "@workspace/commerce/compatibility";
import {
  estimateWattage,
  PSU_HEADROOM_FACTOR,
  validateBuild,
} from "@workspace/commerce/compatibility";
import {
  db,
  inventory,
  type Product,
  type ProductSpec,
  productSpecs,
  products,
} from "@workspace/db";
import { type CategorySlug, isCategorySlug } from "@workspace/db/taxonomy";
import { and, asc, eq } from "drizzle-orm";
import { toSummary } from "./product";
import { storeId } from "./store";
import type { ProductSummary } from "./types";

/**
 * The recommendation the assistant hands back after the interview.
 *
 * Deterministic, and deliberately so. §4 says safety-critical commerce
 * validation must not depend on model reasoning, and picking eight parts that
 * fit each other is exactly that: the budget decides how much each slot may
 * spend, the spec columns decide what can sit next to what, and the
 * compatibility engine gets the last word. A model is a good writer of the
 * sentence around this and a bad chooser of the socket.
 *
 * Every part named is a row the merchant actually stocks, and every upgrade's
 * reason is a difference between two spec values — never "better performance",
 * which is a claim this data cannot support.
 */

export interface BuildUpgrade {
  /**
   * The same part as the engine reads it, carried so the sheet can re-check
   * a swap against the real rules rather than against a local restatement of
   * them. See `lib/assistant/build.ts`.
   */
  component: BuildComponent;
  deltaPaise: number;
  product: ProductSummary;
  /** Measurable, from the spec columns. Never "better performance". */
  reason: string;
}

export interface BuildSlotRow {
  component: BuildComponent;
  recommended: ProductSummary;
  required: boolean;
  selected: boolean;
  slot: string;
  /** The slug the taxonomy knows this slot by. */
  slug: string;
  swapped: boolean;
  /** Absent on most rows. Absence is the default. */
  upgrade?: BuildUpgrade;
}

export interface RecommendedBuild {
  basis: string;
  /** What the engine said about the set as recommended. */
  message: string;
  rows: BuildSlotRow[];
}

interface Candidate {
  attributes: Record<string, unknown> | null;
  category: CategorySlug;
  product: Product;
  specs: ProductSpec | null;
  summary: ProductSummary;
}

/** Which slots the sheet offers, in the order it prints them. */
const SLOTS: { label: string; required: boolean; slug: CategorySlug }[] = [
  { label: "Processor", required: true, slug: "cpu" },
  { label: "Motherboard", required: true, slug: "motherboard" },
  { label: "Memory", required: true, slug: "ram" },
  { label: "Graphics", required: false, slug: "gpu" },
  { label: "Storage", required: true, slug: "storage" },
  { label: "Power supply", required: true, slug: "psu" },
  { label: "Case", required: true, slug: "case" },
  { label: "Cooling", required: false, slug: "cooler" },
];

/**
 * How much of the budget each slot may spend.
 *
 * Weights, not rupees, so the same table works at ₹60,000 and ₹300,000. The
 * graphics share moves with the stated use because that is the one slot where
 * the right answer genuinely differs between a game and a render.
 */
const BASE_SHARE: Record<CategorySlug, number> = {
  case: 0.07,
  cooler: 0.06,
  cpu: 0.18,
  fan: 0,
  gpu: 0.35,
  monitor: 0,
  motherboard: 0.1,
  peripheral: 0,
  psu: 0.08,
  ram: 0.08,
  storage: 0.08,
};

const CPU_HEAVY = /editing|workstation|cad|development|ai|ml/i;

function sharesFor(use: string): Record<CategorySlug, number> {
  if (!CPU_HEAVY.test(use)) {
    return BASE_SHARE;
  }

  /* Editing and CAD spend on cores and memory rather than on the card. */
  return {
    ...BASE_SHARE,
    cpu: 0.26,
    gpu: 0.24,
    ram: 0.13,
    storage: 0.11,
  };
}

async function loadCandidates(): Promise<Map<CategorySlug, Candidate[]>> {
  const merchantId = await storeId();

  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    )
    .orderBy(asc(products.price));

  const byCategory = new Map<CategorySlug, Candidate[]>();

  for (const row of rows) {
    const { product } = row;
    const { category } = product;

    if (!(category && isCategorySlug(category)) || product.stock <= 0) {
      continue;
    }

    const bucket = byCategory.get(category) ?? [];

    bucket.push({
      attributes: product.attributes,
      category,
      product,
      specs: row.specs,
      summary: toSummary(row),
    });
    byCategory.set(category, bucket);
  }

  return byCategory;
}

/** The dearest candidate inside the allowance, or the cheapest if none is. */
function bestWithin(pool: Candidate[], allowancePaise: number) {
  const affordable = pool.filter(
    (entry) => entry.product.price <= allowancePaise
  );

  return affordable.at(-1) ?? pool[0];
}

const SOCKET_SEPARATOR = /\s*,\s*/;

function sockets(spec: ProductSpec | null): string[] {
  return spec?.socket ? spec.socket.split(SOCKET_SEPARATOR) : [];
}

/** Does the case take a board of this form factor? ATX cases take smaller. */
const FORM_FACTOR_ORDER = ["ITX", "mATX", "ATX"];

function caseTakesBoard(caseSpec: ProductSpec | null, board: Candidate) {
  const caseSize = FORM_FACTOR_ORDER.indexOf(caseSpec?.formFactor ?? "");
  const boardSize = FORM_FACTOR_ORDER.indexOf(board.specs?.formFactor ?? "");

  if (caseSize === -1 || boardSize === -1) {
    return true;
  }

  return boardSize <= caseSize;
}

function toComponent(entry: Candidate): BuildComponent {
  return {
    categorySlug: entry.category,
    name: entry.product.name,
    productId: entry.product.id,
    quantity: 1,
    specs: entry.specs,
  };
}

/**
 * Picks eight parts that fit each other, inside the budget where it can.
 *
 * The order is the order the constraints actually chain in: the processor
 * fixes the socket, the socket fixes the board, the board fixes the memory
 * generation and the case size, the case fixes the card length and the cooler
 * height, and the draw of all of it fixes the supply. Choosing the card first
 * — which is how a person shops — means backtracking on every other slot.
 */
type Allowance = (slug: CategorySlug) => number;
type Pools = Map<CategorySlug, Candidate[]>;

function poolFor(pools: Pools, slug: CategorySlug): Candidate[] {
  return pools.get(slug) ?? [];
}

/** The board has to take the processor socket. Nothing else about it binds. */
function pickBoard(pools: Pools, allow: Allowance, socket: string | null) {
  return bestWithin(
    poolFor(pools, "motherboard").filter(
      (entry) => !socket || sockets(entry.specs).includes(socket)
    ),
    allow("motherboard")
  );
}

/** The kit has to be the generation the board takes; DDR4 and DDR5 do not mix. */
function pickMemory(pools: Pools, allow: Allowance, board?: Candidate) {
  const memoryType = board?.specs?.memoryType ?? null;

  return bestWithin(
    poolFor(pools, "ram").filter(
      (entry) => !memoryType || entry.specs?.memoryType === memoryType
    ),
    allow("ram")
  );
}

/** The card has to fit the case, where the case publishes a clearance. */
function pickGpu(pools: Pools, allow: Allowance, enclosure?: Candidate) {
  const clearance = enclosure?.specs?.maxGpuLengthMm ?? null;

  return bestWithin(
    poolFor(pools, "gpu").filter((entry) => {
      const length = entry.specs?.lengthMm;

      return (
        clearance === null ||
        length === null ||
        length === undefined ||
        length <= clearance
      );
    }),
    allow("gpu")
  );
}

/** The cooler has to fit the socket and stand under the roof of the case. */
function pickCooler(
  pools: Pools,
  allow: Allowance,
  socket: string | null,
  enclosure?: Candidate
) {
  const roof = enclosure?.specs?.maxCoolerHeightMm ?? null;

  return bestWithin(
    poolFor(pools, "cooler").filter((entry) => {
      const height = entry.specs?.heightMm;
      const fitsSocket = !socket || sockets(entry.specs).includes(socket);
      const fitsCase =
        roof === null ||
        height === null ||
        height === undefined ||
        height < roof;

      return fitsSocket && fitsCase;
    }),
    allow("cooler")
  );
}

/**
 * The supply, chosen last.
 *
 * It is the only slot whose requirement is a function of every other one, and
 * an ITX case takes an SFX unit — so the first pass asks for both and the
 * second drops the form factor rather than returning nothing. A build with a
 * supply the case cannot hold is a finding the engine will report; a build
 * with no supply at all is one the shopper cannot even look at.
 */
function pickPsu(pools: Pools, chosen: Candidate[], enclosure?: Candidate) {
  const { watts } = estimateWattage(chosen.map(toComponent));
  const needed = Math.ceil(watts * PSU_HEADROOM_FACTOR);
  const pool = poolFor(pools, "psu");
  const big = (entry: Candidate) => (entry.specs?.psuWattage ?? 0) >= needed;
  const small = enclosure?.specs?.formFactor === "ITX";

  return (
    pool.find(
      (entry) => big(entry) && (!small || entry.specs?.formFactor === "SFX")
    ) ??
    pool.find(big) ??
    pool.at(-1)
  );
}

/**
 * Picks eight parts that fit each other, inside the budget where it can.
 *
 * The order is the order the constraints actually chain in: the processor
 * fixes the socket, the socket fixes the board, the board fixes the memory
 * generation and the case size, the case fixes the card length and the cooler
 * height, and the draw of all of it fixes the supply. Choosing the card first
 * — which is how a person shops — means backtracking on every other slot.
 */
function assemble(
  pools: Pools,
  budgetPaise: number,
  use: string
): Map<CategorySlug, Candidate> {
  const shares = sharesFor(use);
  const allow: Allowance = (slug) =>
    Math.round(budgetPaise * (shares[slug] ?? 0));

  const cpu = bestWithin(poolFor(pools, "cpu"), allow("cpu"));
  const socket = cpu?.specs?.socket ?? null;
  const board = pickBoard(pools, allow, socket);

  const enclosure = bestWithin(
    poolFor(pools, "case").filter(
      (entry) => !board || caseTakesBoard(entry.specs, board)
    ),
    allow("case")
  );

  const parts: [CategorySlug, Candidate | undefined][] = [
    ["cpu", cpu],
    ["motherboard", board],
    ["ram", pickMemory(pools, allow, board)],
    ["case", enclosure],
    ["gpu", pickGpu(pools, allow, enclosure)],
    ["cooler", pickCooler(pools, allow, socket, enclosure)],
    ["storage", bestWithin(poolFor(pools, "storage"), allow("storage"))],
  ];

  const chosen = new Map<CategorySlug, Candidate>();

  for (const [slug, part] of parts) {
    if (part) {
      chosen.set(slug, part);
    }
  }

  const psu = pickPsu(pools, [...chosen.values()], enclosure);

  if (psu) {
    chosen.set("psu", psu);
  }

  return chosen;
}

/* ── Upgrades ───────────────────────────────────────────────────────────── */

const CAPACITY = /(\d+)\s*(GB|TB)/i;
const TB_TO_GB = 1024;

function attribute(entry: Candidate, key: string): string | null {
  const value = entry.attributes?.[key];

  return typeof value === "string" ? value : null;
}

function capacityGb(entry: Candidate): number | null {
  if (entry.specs?.memoryCapacityGb) {
    return entry.specs.memoryCapacityGb;
  }

  const match = CAPACITY.exec(entry.product.name);

  if (!match?.[1]) {
    return null;
  }

  const size = Number(match[1]);

  return match[2]?.toUpperCase() === "TB" ? size * TB_TO_GB : size;
}

function readableGb(gb: number): string {
  return gb >= TB_TO_GB ? `${gb / TB_TO_GB}TB` : `${gb}GB`;
}

type Comparator = (from: Candidate, to: Candidate) => string | null;

/** "10C/16T instead of 6C/12T" — a stated attribute, changed. */
function byAttribute(key: string): Comparator {
  return (from, to) => {
    const before = attribute(from, key);
    const after = attribute(to, key);

    return before && after && before !== after
      ? `${after} instead of ${before}`
      : null;
  };
}

/** "2TB instead of 1TB" — more of the thing the part is measured in. */
const byCapacity: Comparator = (from, to) => {
  const before = capacityGb(from);
  const after = capacityGb(to);

  return before && after && after > before
    ? `${readableGb(after)} instead of ${readableGb(before)}`
    : null;
};

/** A numeric spec that is better for being larger, said in its own units. */
function byNumber(
  field: "psuWattage" | "m2Slots" | "maxGpuLengthMm" | "tdpWatts",
  say: (before: number, after: number) => string
): Comparator {
  return (from, to) => {
    const before = from.specs?.[field];
    const after = to.specs?.[field];

    return before && after && after > before ? say(before, after) : null;
  };
}

/**
 * Why one part is worth more than another, per category.
 *
 * A category with no entry has no measurable upgrade story in this data, and
 * gets no offer — which is the point. A sheet where every row carries one is a
 * sheet where no offer means anything.
 */
const UPGRADE_REASON: Partial<Record<CategorySlug, Comparator>> = {
  case: byNumber(
    "maxGpuLengthMm",
    (before, after) => `${after} mm of card clearance instead of ${before} mm`
  ),
  cooler: byNumber(
    "tdpWatts",
    (before, after) => `rated to ${after} W instead of ${before} W`
  ),
  cpu: byAttribute("cores"),
  gpu: byAttribute("vram"),
  motherboard: byNumber(
    "m2Slots",
    (before, after) => `${after} M.2 slots instead of ${before}`
  ),
  psu: byNumber(
    "psuWattage",
    (before, after) => `${after - before} W more headroom`
  ),
  ram: byCapacity,
  storage: byCapacity,
};

function describeUpgrade(from: Candidate, to: Candidate): string | null {
  return UPGRADE_REASON[from.category]?.(from, to) ?? null;
}

/** The cheapest part above this one that still validates and says why. */
function upgradeFor(
  pool: Candidate[],
  current: Candidate,
  rest: BuildComponent[]
): BuildUpgrade | null {
  const dearer = pool.filter(
    (entry) => entry.product.price > current.product.price
  );

  for (const candidate of dearer) {
    const reason = describeUpgrade(current, candidate);

    if (!reason) {
      continue;
    }

    const validation = validateBuild([...rest, toComponent(candidate)]);
    const blocked = validation.issues.some(
      (issue) => issue.severity === "blocking"
    );

    if (blocked) {
      continue;
    }

    return {
      component: toComponent(candidate),
      deltaPaise: candidate.product.price - current.product.price,
      product: candidate.summary,
      reason,
    };
  }

  return null;
}

const DEFAULT_BUDGET_RUPEES = 120_000;
const PAISE = 100;

export async function recommendBuild(
  answers: Record<string, string | undefined>
): Promise<RecommendedBuild> {
  const budgetRupees = Number(answers.budget ?? 0) || DEFAULT_BUDGET_RUPEES;
  const use = answers.use ?? "Gaming";
  const resolution = answers.resolution ?? "1440p";

  const pools = await loadCandidates();
  const chosen = assemble(pools, budgetRupees * PAISE, use);
  const components = [...chosen.values()].map(toComponent);
  const validation = validateBuild(components);

  const rows: BuildSlotRow[] = [];

  for (const slot of SLOTS) {
    const entry = chosen.get(slot.slug);

    if (!entry) {
      continue;
    }

    const rest = components.filter(
      (component) => component.productId !== entry.product.id
    );

    rows.push({
      component: toComponent(entry),
      recommended: entry.summary,
      required: slot.required,
      selected: true,
      slot: slot.label,
      slug: slot.slug,
      swapped: false,
      upgrade: upgradeFor(pools.get(slot.slug) ?? [], entry, rest) ?? undefined,
    });
  }

  return {
    basis: [
      budgetRupees ? `₹${budgetRupees.toLocaleString("en-IN")}` : null,
      resolution,
      use.toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    message:
      validation.issues.find((issue) => issue.severity === "blocking")
        ?.message ??
      `${rows.length} parts, checked against each other by the compatibility engine.`,
    rows,
  };
}
