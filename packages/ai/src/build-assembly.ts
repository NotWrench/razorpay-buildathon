import type { BuildComponent } from "@workspace/commerce/compatibility";
import {
  estimateWattage,
  PSU_HEADROOM_FACTOR,
  validateBuild,
} from "@workspace/commerce/compatibility";
import {
  db,
  inventory,
  type ProductSpec,
  productSpecs,
  products,
} from "@workspace/db";
import { type CategorySlug, isCategorySlug } from "@workspace/db/taxonomy";
import { and, asc, eq } from "drizzle-orm";
import { type Candidate, describeUpgrade } from "./build-upgrades";

/**
 * Choosing eight parts that fit each other.
 *
 * Deterministic, and deliberately so. §4 says safety-critical commerce
 * validation must not depend on model reasoning, and this is exactly that: the
 * budget decides how much each slot may spend, the spec columns decide what
 * can sit next to what, and the compatibility engine gets the last word. A
 * model is a good writer of the sentence around this and a bad chooser of the
 * socket.
 *
 * It lives here, in the agent package, rather than in the storefront, because
 * two callers need the same answer and must not be allowed to differ: the
 * `assembleBuild` tool, and the storefront's own recommendation screen. Before
 * this, only the screen could do it, so the agent had to reach the same result
 * through eight separate searches inside a twelve-step budget — which is most
 * of why a build turn took a minute and a half when it finished at all.
 *
 * What it returns is rows, not prose and not pictures: the chosen product, its
 * specs, and the measured reason an upgrade is worth more. Rendering those as
 * a product card is the storefront's job and stays there, which is why nothing
 * in this file knows what a `ProductSummary` is.
 *
 * Every part named is a row the merchant actually stocks, and every upgrade's
 * reason is a difference between two spec values — never "better performance",
 * which is a claim this data cannot support.
 */

export interface BuildUpgrade {
  /** The part the buyer would be swapping to. */
  candidate: Candidate;
  /**
   * The same part as the engine reads it, carried so a sheet can re-check a
   * swap against the real rules rather than against a local restatement of
   * them.
   */
  component: BuildComponent;
  deltaPaise: number;
  /** Measurable, from the spec columns. Never "better performance". */
  reason: string;
}

/** One slot of the assembled machine, as chosen. */
export interface AssembledSlot {
  /** The part chosen for this slot. */
  candidate: Candidate;
  component: BuildComponent;
  /** How the slot prints: "Processor", "Graphics". */
  label: string;
  required: boolean;
  slug: CategorySlug;
  /** Absent on most rows. Absence is the default. */
  upgrade?: BuildUpgrade;
}

export interface AssembledBuild {
  /** What the choice was made on: "₹80,000 · 1440p · gaming". */
  basis: string;
  /** The engine's verdict on the set as chosen. */
  message: string;
  slots: AssembledSlot[];
  totalPaise: number;
  /** Estimated draw of the set, in watts. */
  wattage: number;
}

export type { Candidate } from "./build-upgrades";

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

async function loadCandidates(
  merchantId: string
): Promise<Map<CategorySlug, Candidate[]>> {
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
      lowStockThreshold: row.lowStockThreshold,
      product,
      specs: row.specs,
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
      candidate,
      component: toComponent(candidate),
      deltaPaise: candidate.product.price - current.product.price,
      reason,
    };
  }

  return null;
}

const DEFAULT_BUDGET_PAISE = 12_000_000;
const PAISE = 100;

/**
 * Assembles a complete machine for a budget and a use case.
 *
 * The one entry point. Callers pass what the buyer said and get back rows they
 * can render or narrate; nothing about which socket takes which board is
 * decided anywhere but here.
 *
 * A missing budget is a default rather than a refusal. Somebody who has said
 * "a gaming PC" and nothing else should still see a machine — a sheet with a
 * price on it is a far better question than another question, and they can
 * move the number once they see what it buys.
 */
export async function assembleBuild(options: {
  /** What they said they can spend. Zero or absent takes the default. */
  budgetPaise?: number | null;
  merchantId: string;
  /** How they described the resolution, if they did. For the basis line. */
  targetResolution?: string | null;
  /** Gaming, editing, development. Steers the budget split, not the rules. */
  useCase?: string | null;
}): Promise<AssembledBuild> {
  const budgetPaise = options.budgetPaise || DEFAULT_BUDGET_PAISE;
  const useCase = options.useCase ?? "Gaming";

  const pools = await loadCandidates(options.merchantId);
  const chosen = assemble(pools, budgetPaise, useCase);
  const components = [...chosen.values()].map(toComponent);
  const validation = validateBuild(components);

  const slots: AssembledSlot[] = [];

  for (const slot of SLOTS) {
    const entry = chosen.get(slot.slug);

    if (!entry) {
      continue;
    }

    const rest = components.filter(
      (component) => component.productId !== entry.product.id
    );

    slots.push({
      candidate: entry,
      component: toComponent(entry),
      label: slot.label,
      required: slot.required,
      slug: slot.slug,
      upgrade: upgradeFor(poolFor(pools, slot.slug), entry, rest) ?? undefined,
    });
  }

  return {
    basis: [
      `₹${Math.round(budgetPaise / PAISE).toLocaleString("en-IN")}`,
      options.targetResolution,
      useCase.toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    /*
     * A blocking issue is the headline when there is one. Reporting "8 parts
     * checked" over a build that does not fit together would be true and
     * useless.
     */
    message:
      validation.issues.find((issue) => issue.severity === "blocking")
        ?.message ??
      `${slots.length} parts, checked against each other by the compatibility engine.`,
    slots,
    totalPaise: slots.reduce(
      (total, slot) => total + slot.candidate.product.price,
      0
    ),
    wattage: validation.estimatedWattage,
  };
}
