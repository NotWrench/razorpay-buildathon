import {
  type CategorySlug,
  db,
  inventory,
  productSpecs,
  products,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { formatPaise } from "./money";
import { embeddingModelId } from "./provider";

/**
 * Whether an AI buyer can actually see, compare and trust a product.
 *
 * The platform side of "agent-readable catalog" is done: there is a
 * `catalog.json`, a discovery manifest, an MCP server. What none of that tells
 * a merchant is why a buying agent walked past a product they have twelve of
 * on the shelf.
 *
 * The reasons are dull and specific, and every one of them is a column that is
 * null. A product with no typed specs cannot be compared or slotted into a
 * build — the compatibility engine returns `insufficient_data`, the assistant
 * dutifully says "check the measurement yourself", and the buyer picks
 * something else. A product with no embedding is not merely ranked low, it is
 * unreachable by semantic search. A product with no threshold has no honest
 * stock signal.
 *
 * None of that is visible anywhere in the merchant's room, so this scores it,
 * names the missing field, and prices the gap. "34% of your catalogue is
 * invisible to an AI buyer, and it is ₹8.4 lakh of stock" is a sentence a
 * merchant acts on. "Improve your data quality" is not.
 */

/** How short a description is before it grounds nothing. */
const MIN_DESCRIPTION_CHARS = 60;

/**
 * The specs each category needs before the engine can judge it.
 *
 * Each entry names the rule that reads it, because the list is otherwise
 * arbitrary-looking and would drift the first time somebody tidied it. These
 * are the fields whose absence produces `insufficient_data` — not everything
 * the table can hold.
 */
const REQUIRED_SPECS: Partial<
  Record<CategorySlug, { field: keyof typeof productSpecs.$inferSelect; why: string }[]>
> = {
  case: [
    { field: "formFactor", why: "board_case_fit" },
    { field: "maxGpuLengthMm", why: "gpu_case_clearance" },
    { field: "maxCoolerHeightMm", why: "cooler_case_clearance" },
  ],
  cooler: [
    { field: "socket", why: "cooler_cpu_socket" },
    { field: "heightMm", why: "cooler_case_clearance" },
  ],
  cpu: [
    { field: "socket", why: "cpu_motherboard_socket" },
    { field: "tdpWatts", why: "psu_headroom" },
  ],
  gpu: [
    { field: "lengthMm", why: "gpu_case_clearance" },
    { field: "tdpWatts", why: "psu_headroom" },
    { field: "pciePowerConnectors", why: "psu_gpu_connectors" },
  ],
  motherboard: [
    { field: "socket", why: "cpu_motherboard_socket" },
    { field: "memoryType", why: "motherboard_ram_generation" },
    { field: "formFactor", why: "board_case_fit" },
    { field: "memorySlots", why: "motherboard_ram_slots" },
  ],
  psu: [
    { field: "psuWattage", why: "psu_headroom" },
    { field: "pciePowerConnectors", why: "psu_gpu_connectors" },
  ],
  ram: [
    { field: "memoryType", why: "motherboard_ram_generation" },
    { field: "memoryCapacityGb", why: "build_completeness" },
  ],
  storage: [{ field: "storageInterface", why: "storage_interface_slots" }],
};

export interface ReadinessGap {
  /**
   * Whether this absence stops an agent recommending the product at all.
   *
   * The distinction is the whole point of the number below it. A product with
   * no photograph is a worse listing; a product with no embedding cannot be
   * found, and one with no socket makes the compatibility engine answer
   * `insufficient_data` — which the assistant correctly relays as "check this
   * yourself", and the buyer goes elsewhere. Counting a missing image as
   * revenue at risk would inflate the figure with products that sell fine, and
   * a merchant who acts on that number once and finds nothing wrong will not
   * act on it again.
   */
  blocking: boolean;
  /** Which capability the absence costs them. */
  costs: string;
  /** What is missing, in a merchant's words. */
  detail: string;
  field: string;
}

export interface ProductReadiness {
  /** True when at least one gap stops an agent recommending it. */
  blocked: boolean;
  category: string | null;
  gaps: ReadinessGap[];
  name: string;
  productId: string;
  /** 0–100. Nothing missing is 100. */
  score: number;
  /** Retail value of the stock behind this product, in paise. */
  stockValuePaise: number;
}

export interface CatalogReadiness {
  /** How the score is computed, stated so the merchant can disagree with it. */
  assumptions: string;
  /** Products with any gap at all, worst money first. */
  needsWork: ProductReadiness[];
  /** The subset an agent genuinely cannot recommend. */
  blocked: ProductReadiness[];
  gapCounts: { count: number; field: string }[];
  productsScored: number;
  /** Mean score across the active catalogue, 0–100. */
  score: number;
  /** Stock value tied up in products an agent cannot properly recommend. */
  revenueAtRiskPaise: number;
}

/** The checks that apply to every product, whatever it is. */
function universalGaps(product: {
  categoryId: string | null;
  description: string | null;
  embedding: unknown;
  embeddingModel: string | null;
  imageUrl: string | null;
}): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];

  if (!product.categoryId) {
    gaps.push({
      blocking: true,
      costs: "the build assembler cannot put it in a slot",
      detail: "No resolved category",
      field: "categoryId",
    });
  }

  /*
   * A vector written by a different model is not a worse vector, it is an
   * incomparable one — search only ever compares rows written by the model
   * that embeds the query, so a stale row is as unreachable as an unembedded
   * one. `backfillEmbeddings` applies exactly this test, and it is repeated
   * rather than shared so the two cannot drift into disagreeing about which
   * products are findable.
   */
  const currentModel = embeddingModelId();

  if (!product.embedding) {
    gaps.push({
      blocking: true,
      costs: "semantic search cannot find it at all",
      detail: "Not embedded",
      field: "embedding",
    });
  } else if (product.embeddingModel !== currentModel) {
    gaps.push({
      blocking: true,
      costs: "search skips it — its vector came from a different model",
      detail: `Embedded by ${product.embeddingModel ?? "an unrecorded model"}, not ${currentModel}`,
      field: "embeddingModel",
    });
  }

  if (
    !product.description ||
    product.description.trim().length < MIN_DESCRIPTION_CHARS
  ) {
    gaps.push({
      blocking: false,
      costs: "the assistant has nothing to ground 'why this fits' in",
      detail: "Description missing or under 60 characters",
      field: "description",
    });
  }

  if (!product.imageUrl) {
    gaps.push({
      blocking: false,
      costs: "a human cannot confirm what the agent picked",
      detail: "No image",
      field: "imageUrl",
    });
  }

  return gaps;
}

/**
 * Scores every active product on what an agent needs from it.
 *
 * Deliberately not weighted. A weighting would be a judgement about which
 * absence hurts most, and the honest answer is that it depends on what the
 * buyer asked for — a missing GPU length costs nothing until somebody wants it
 * in a small case, and then it costs the sale. Each check is worth the same,
 * and the gaps are listed so the merchant can weigh them for themselves.
 */
export async function getCatalogReadiness(
  merchantId: string
): Promise<CatalogReadiness> {
  const rows = await db
    .select({
      categoryId: products.categoryId,
      categorySlug: products.category,
      description: products.description,
      embedding: products.embedding,
      embeddingModel: products.embeddingModel,
      id: products.id,
      imageUrl: products.imageUrl,
      lowStockThreshold: inventory.lowStockThreshold,
      name: products.name,
      price: products.price,
      specs: productSpecs,
      stock: products.stock,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  const scored: ProductReadiness[] = [];
  const gapCounts = new Map<string, number>();

  for (const row of rows) {
    const gaps = universalGaps(row);

    if (row.lowStockThreshold === null) {
      gaps.push({
        blocking: false,
        costs: "no honest low-stock signal, so it never appears in a report",
        detail: "No low-stock threshold",
        field: "lowStockThreshold",
      });
    }

    const required = REQUIRED_SPECS[row.categorySlug as CategorySlug] ?? [];
    let checks = 5 + required.length;

    // A category with no required specs (a monitor, a peripheral) is not
    // penalised for the specs it was never expected to publish.
    if (required.length === 0) {
      checks = 5;
    }

    for (const spec of required) {
      const value = row.specs?.[spec.field];

      if (value === null || value === undefined) {
        gaps.push({
          blocking: true,
          costs: `${spec.why} returns insufficient_data`,
          detail: `No ${String(spec.field)}`,
          field: String(spec.field),
        });
      }
    }

    for (const gap of gaps) {
      gapCounts.set(gap.field, (gapCounts.get(gap.field) ?? 0) + 1);
    }

    scored.push({
      blocked: gaps.some((gap) => gap.blocking),
      category: row.categorySlug,
      gaps,
      name: row.name,
      productId: row.id,
      score: Math.max(0, Math.round(((checks - gaps.length) / checks) * 100)),
      stockValuePaise: row.price * row.stock,
    });
  }

  const byMoney = (a: ProductReadiness, b: ProductReadiness) =>
    b.stockValuePaise - a.stockValuePaise;

  const needsWork = scored
    .filter((product) => product.gaps.length > 0)
    .sort(byMoney);
  const blocked = needsWork.filter((product) => product.blocked);

  // Only the blocking ones. See `ReadinessGap.blocking` for why.
  const revenueAtRiskPaise = blocked.reduce(
    (sum, product) => sum + product.stockValuePaise,
    0
  );

  return {
    assumptions:
      "Each product is scored on the fields an AI buyer needs to find it, compare it and trust its stock: a resolved category, a current embedding, a real description, an image, a low-stock threshold, and the typed specs its category's compatibility rules read. Every check counts the same towards the score. " +
      "Revenue at risk counts only the products with a blocking gap — no category, no usable embedding, or a missing spec that makes the compatibility engine answer insufficient_data. A missing photograph is a worse listing, not an unsellable one, and counting it here would inflate the figure with products that sell fine. " +
      "It is the stock value exposed, not a prediction of what will be lost.",
    blocked,
    needsWork,
    gapCounts: [...gapCounts.entries()]
      .map(([field, count]) => ({ count, field }))
      .sort((a, b) => b.count - a.count),
    productsScored: scored.length,
    revenueAtRiskPaise,
    score:
      scored.length === 0
        ? 100
        : Math.round(
            scored.reduce((sum, product) => sum + product.score, 0) /
              scored.length
          ),
  };
}

/** A merchant-readable line for the agent to quote rather than reassemble. */
export function describeReadiness(readiness: CatalogReadiness): string {
  if (readiness.needsWork.length === 0) {
    return `All ${readiness.productsScored} products carry everything an AI buyer needs. The catalogue scores 100.`;
  }

  const head = `The catalogue scores ${readiness.score} out of 100, with ${readiness.needsWork.length} of ${readiness.productsScored} products missing something.`;

  if (readiness.blocked.length === 0) {
    return `${head} None of it is blocking — an agent can still find and recommend every product.`;
  }

  return (
    `${head} ${readiness.blocked.length} of those an agent cannot properly recommend at all, ` +
    `holding ${formatPaise(readiness.revenueAtRiskPaise)} of stock between them.`
  );
}
