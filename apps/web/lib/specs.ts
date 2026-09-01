import type { ProductSpec } from "@workspace/db";

/**
 * Specifications, as text.
 *
 * The columns are the compatibility engine's inputs, so what a card shows is
 * exactly what the rules will read — a shopper who sees "AM5" on the card and
 * a socket mismatch in the builder is looking at the same field twice, not at
 * two different sources.
 *
 * A null is never rendered as a zero or an em dash in a summary line: it is
 * omitted, because "unknown" is a state the buyer should meet in the
 * compatibility report where it can be explained, not silently in a spec list.
 */

export interface SpecEntry {
  label: string;
  value: string;
}

const LABELS: Record<string, string> = {
  chipset: "Chipset",
  formFactor: "Form factor",
  heightMm: "Height",
  lengthMm: "Length",
  m2Slots: "M.2 slots",
  maxCoolerHeightMm: "Max cooler height",
  maxGpuLengthMm: "Max GPU length",
  memoryCapacityGb: "Capacity",
  memorySlots: "Memory slots",
  memorySpeedMhz: "Memory speed",
  memoryType: "Memory type",
  pciePowerConnectors: "Power connectors",
  psuWattage: "Supply wattage",
  recommendedPsuWatts: "Recommended PSU",
  sataPorts: "SATA ports",
  socket: "Socket",
  storageInterface: "Interface",
  tdpWatts: "TDP",
  widthMm: "Width",
};

const UNITS: Record<string, string> = {
  heightMm: "mm",
  lengthMm: "mm",
  maxCoolerHeightMm: "mm",
  maxGpuLengthMm: "mm",
  memoryCapacityGb: "GB",
  memorySpeedMhz: "MHz",
  psuWattage: "W",
  recommendedPsuWatts: "W",
  tdpWatts: "W",
  widthMm: "mm",
};

/** The fields worth leading with, per category. */
const HEADLINE: Record<string, (keyof ProductSpec)[]> = {
  case: ["formFactor", "maxGpuLengthMm", "maxCoolerHeightMm"],
  cooler: ["socket", "heightMm", "tdpWatts"],
  cpu: ["socket", "tdpWatts", "recommendedPsuWatts"],
  fan: ["widthMm"],
  gpu: ["lengthMm", "tdpWatts", "recommendedPsuWatts"],
  motherboard: ["socket", "chipset", "formFactor", "memoryType"],
  psu: ["psuWattage", "formFactor"],
  ram: ["memoryType", "memoryCapacityGb", "memorySpeedMhz"],
  storage: ["storageInterface", "memoryCapacityGb"],
};

const CAMEL_BOUNDARY = /([A-Z])/g;
const FIRST_CHARACTER = /^./;

const HIDDEN = new Set([
  "categorySlug",
  "createdAt",
  "extra",
  "id",
  "merchantId",
  "productId",
  "updatedAt",
]);

function render(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const connector = entry as { count?: number; pins?: number };

        return connector.pins
          ? `${connector.count ?? 1} × ${connector.pins}-pin`
          : String(entry);
      })
      .join(", ");
  }

  const unit = UNITS[field];

  return unit ? `${value} ${unit}` : String(value);
}

/** Two or three fields for a card, chosen by category. */
export function headlineSpecs(
  categorySlug: string | null,
  specs: ProductSpec | null,
  limit = 3
): string[] {
  if (!specs) {
    return [];
  }

  const fields = HEADLINE[categorySlug ?? ""] ?? [];

  return fields
    .map((field) => render(String(field), specs[field]))
    .filter((value): value is string => value !== null)
    .slice(0, limit);
}

/** Every stated specification, for the product page. */
export function specEntries(specs: ProductSpec | null): SpecEntry[] {
  if (!specs) {
    return [];
  }

  const entries: SpecEntry[] = [];

  for (const [field, value] of Object.entries(specs)) {
    if (HIDDEN.has(field)) {
      continue;
    }

    const rendered = render(field, value);

    if (rendered !== null) {
      entries.push({ label: LABELS[field] ?? field, value: rendered });
    }
  }

  return entries;
}

/** Display-only attributes from `products.attributes`, which the engine ignores. */
export function attributeEntries(
  attributes: Record<string, unknown> | null
): SpecEntry[] {
  if (!attributes) {
    return [];
  }

  return Object.entries(attributes)
    .map(([label, value]) => ({
      label: label
        .replace(CAMEL_BOUNDARY, " $1")
        .replace(FIRST_CHARACTER, (character) => character.toUpperCase()),
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }))
    .filter((entry) => entry.value !== "" && entry.value !== "null");
}
