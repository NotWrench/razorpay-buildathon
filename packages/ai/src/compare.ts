import {
  db,
  type ProductSpec,
  productCategories,
  productSpecs,
  products,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Side-by-side comparison, computed rather than narrated.
 *
 * §6 asks the agent to compare real products on meaningful attributes. The
 * division of labour matters: this module decides which attributes are
 * comparable, reads the values, and works out which is better and by how much.
 * The model gets a finished table and explains what the difference means in
 * practice.
 *
 * That split is §19 again. A model asked to compare two cards will happily
 * produce a plausible VRAM figure for one it has never seen. Here it cannot —
 * every number in the matrix came from a row, and an attribute neither product
 * publishes is reported as unknown rather than filled in.
 */

/** Which spec fields are worth comparing, per category. */
const COMPARABLE_FIELDS: Record<string, (keyof ProductSpec)[]> = {
  case: [
    "formFactor",
    "maxGpuLengthMm",
    "maxCoolerHeightMm",
    "lengthMm",
    "widthMm",
    "heightMm",
  ],
  cooler: ["heightMm", "socket", "tdpWatts"],
  cpu: ["socket", "memoryType", "tdpWatts"],
  gpu: [
    "memoryCapacityGb",
    "tdpWatts",
    "recommendedPsuWatts",
    "lengthMm",
    "pciePowerConnectors",
  ],
  motherboard: [
    "socket",
    "chipset",
    "formFactor",
    "memoryType",
    "memorySlots",
    "memorySpeedMhz",
    "memoryCapacityGb",
    "m2Slots",
    "sataPorts",
  ],
  psu: ["psuWattage", "formFactor", "pciePowerConnectors", "lengthMm"],
  ram: ["memoryType", "memoryCapacityGb", "memorySpeedMhz", "memorySlots"],
  storage: ["storageInterface"],
};

/**
 * Comparable values that live in `extra` rather than in a column.
 *
 * The engine never reads `extra` — it is the leftovers bin, and a
 * compatibility rule must not depend on an unindexed blob. Comparison is a
 * different job: a buyer choosing between two monitors is asking about refresh
 * rate and resolution, and answering "they both cost about the same" because
 * the numbers are one level down would be a poor showing.
 */
const COMPARABLE_EXTRAS: Record<string, string[]> = {
  fan: ["sizeMm"],
  monitor: ["resolution", "refreshHz", "sizeIn"],
  storage: ["capacityGb"],
};

/**
 * How to read a higher number for each field.
 *
 * Most are plainly better when larger. A few are not, and getting them
 * backwards would be worse than saying nothing: a case that clears a longer
 * card is better, but a card that *is* longer is harder to fit, and a part
 * that draws more power is a cost rather than a feature.
 */
const HIGHER_IS_BETTER: Record<string, boolean> = {
  capacityGb: true,
  heightMm: false,
  lengthMm: false,
  m2Slots: true,
  maxCoolerHeightMm: true,
  maxGpuLengthMm: true,
  memoryCapacityGb: true,
  memorySlots: true,
  memorySpeedMhz: true,
  psuWattage: true,
  recommendedPsuWatts: false,
  refreshHz: true,
  sataPorts: true,
  sizeIn: true,
  tdpWatts: false,
};

const HUMAN_LABELS: Record<string, string> = {
  capacityGb: "Capacity (GB)",
  chipset: "Chipset",
  formFactor: "Form factor",
  heightMm: "Height (mm)",
  lengthMm: "Length (mm)",
  m2Slots: "M.2 slots",
  maxCoolerHeightMm: "Cooler clearance (mm)",
  maxGpuLengthMm: "Card clearance (mm)",
  memoryCapacityGb: "Capacity (GB)",
  memorySlots: "Memory slots",
  memorySpeedMhz: "Memory speed (MHz)",
  memoryType: "Memory type",
  pciePowerConnectors: "PCIe power connectors",
  psuWattage: "Wattage (W)",
  recommendedPsuWatts: "Recommended supply (W)",
  refreshHz: "Refresh rate (Hz)",
  resolution: "Resolution",
  sataPorts: "SATA ports",
  sizeIn: "Size (inches)",
  sizeMm: "Size (mm)",
  socket: "Socket",
  storageInterface: "Interface",
  tdpWatts: "Power draw (W)",
};

export interface ComparisonCell {
  productId: string;
  /** Rendered for display; null when the product does not publish it. */
  value: string | null;
}

export interface ComparisonRow {
  /** Set only for numeric attributes where one product genuinely leads. */
  betterProductId?: string;
  cells: ComparisonCell[];
  /** How much better, in the attribute's own units. */
  differenceLabel?: string;
  field: string;
  label: string;
  /** True when no product in the set publishes this attribute. */
  unknownForAll: boolean;
}

export interface ComparisonResult {
  /** Null when the products span more than one category. */
  categorySlug: string | null;
  /** Attributes compared, price and stock first. */
  matrix: ComparisonRow[];
  note?: string;
  products: {
    brand: string | null;
    categorySlug: string | null;
    inStock: boolean;
    name: string;
    pricePaise: number;
    productId: string;
  }[];
}

function render(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const connector = entry as { count?: number; pins?: number };

        return connector.pins
          ? `${connector.count ?? 1} x ${connector.pins}-pin`
          : JSON.stringify(entry);
      })
      .join(", ");
  }

  return String(value);
}

/**
 * Compares 2–4 products the merchant actually sells.
 *
 * Products from different categories are still compared, on whatever fields
 * they share, with a note saying so — refusing outright would be unhelpful
 * when a buyer genuinely asks whether to spend the money on a card or a
 * monitor. What is never done is inventing a shared attribute.
 */
export async function compareProducts(
  merchantId: string,
  productIds: string[]
): Promise<ComparisonResult> {
  const unique = [...new Set(productIds)];

  const rows = await db
    .select({
      brand: products.brand,
      categorySlug: productCategories.slug,
      name: products.name,
      price: products.price,
      productId: products.id,
      specs: productSpecs,
      stock: products.stock,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(
      and(eq(products.merchantId, merchantId), inArray(products.id, unique))
    );

  // Keep the caller's order — the buyer named them in an order that means
  // something to them, and the matrix should read the same way.
  const byId = new Map(rows.map((row) => [row.productId, row]));
  const ordered = unique.flatMap((id) => {
    const row = byId.get(id);

    return row ? [row] : [];
  });

  const categories = [
    ...new Set(ordered.map((row) => row.categorySlug).filter(Boolean)),
  ];
  const categorySlug = categories.length === 1 ? (categories[0] ?? null) : null;

  const fields = categorySlug
    ? (COMPARABLE_FIELDS[categorySlug] ?? [])
    : // Mixed categories: compare the union, and let unknownForAll prune it.
      [
        ...new Set(
          categories.flatMap((slug) => COMPARABLE_FIELDS[slug as string] ?? [])
        ),
      ];

  const matrix: ComparisonRow[] = [
    {
      cells: ordered.map((row) => ({
        productId: row.productId,
        value: String(row.price),
      })),
      field: "pricePaise",
      label: "Price (paise)",
      unknownForAll: false,
      ...cheapest(ordered),
    },
    {
      cells: ordered.map((row) => ({
        productId: row.productId,
        value: row.stock > 0 ? `${row.stock} in stock` : "out of stock",
      })),
      field: "stock",
      label: "Availability",
      unknownForAll: false,
    },
  ];

  for (const field of fields) {
    const cells = ordered.map((row) => ({
      productId: row.productId,
      value: render(row.specs?.[field]),
    }));

    // A row nobody publishes is noise, not information.
    if (cells.every((cell) => cell.value === null)) {
      continue;
    }

    matrix.push({
      cells,
      field: String(field),
      label: HUMAN_LABELS[String(field)] ?? String(field),
      unknownForAll: false,
      ...best(
        ordered.map((row) => ({
          productId: row.productId,
          value: row.specs?.[field],
        })),
        String(field)
      ),
    });
  }

  const extraFields = categorySlug
    ? (COMPARABLE_EXTRAS[categorySlug] ?? [])
    : [
        ...new Set(
          categories.flatMap((slug) => COMPARABLE_EXTRAS[slug as string] ?? [])
        ),
      ];

  for (const field of extraFields) {
    const values = ordered.map((row) => ({
      productId: row.productId,
      value: (row.specs?.extra as Record<string, unknown> | null)?.[field],
    }));

    const cells = values.map((entry) => ({
      productId: entry.productId,
      value: render(entry.value),
    }));

    if (cells.every((cell) => cell.value === null)) {
      continue;
    }

    matrix.push({
      cells,
      field,
      label: HUMAN_LABELS[field] ?? field,
      unknownForAll: false,
      ...best(values, field),
    });
  }

  return {
    categorySlug,
    matrix,
    note:
      categorySlug === null && ordered.length > 1
        ? "These products are in different categories, so only the attributes they happen to share are compared. Say so rather than implying a like-for-like comparison."
        : undefined,
    products: ordered.map((row) => ({
      brand: row.brand,
      categorySlug: row.categorySlug,
      inStock: row.stock > 0,
      name: row.name,
      pricePaise: row.price,
      productId: row.productId,
    })),
  };
}

function cheapest(rows: { price: number; productId: string }[]) {
  if (rows.length < 2) {
    return {};
  }

  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const [lowest, next] = sorted;

  if (!(lowest && next) || lowest.price === next.price) {
    return {};
  }

  return {
    betterProductId: lowest.productId,
    differenceLabel: `${next.price - lowest.price} paise cheaper than the next`,
  };
}

/**
 * Which product leads on one attribute, and by how much.
 *
 * Only for numeric fields with a stated direction, and only when every product
 * publishes the value. A comparison against a missing number is not a
 * comparison, and reporting one would be exactly the invented certainty §4
 * forbids.
 */
function best(values: { productId: string; value: unknown }[], field: string) {
  const direction = HIGHER_IS_BETTER[field];

  if (direction === undefined || values.length < 2) {
    return {};
  }

  if (values.some((entry) => typeof entry.value !== "number")) {
    return {};
  }

  const numeric = values as { productId: string; value: number }[];
  const sorted = [...numeric].sort((a, b) =>
    direction ? b.value - a.value : a.value - b.value
  );

  const [leader, runnerUp] = sorted;

  if (!(leader && runnerUp) || leader.value === runnerUp.value) {
    return {};
  }

  return {
    betterProductId: leader.productId,
    differenceLabel: `${Math.abs(leader.value - runnerUp.value)} ${direction ? "more" : "less"} than the next`,
  };
}
