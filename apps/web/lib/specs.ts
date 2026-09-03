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
const WORDS = /\S+/g;

/**
 * Attribute keys that are acronyms rather than words.
 *
 * `attributes` is free-form JSON, so its keys arrive as whatever was typed —
 * `vram`, `igpu`, `vrm`. Title-casing those blindly produces "Vram", which
 * reads as a typo on a spec table sitting next to "TDP" and "PSU".
 */
const ACRONYMS = new Set([
  "cpu",
  "gpu",
  "hdd",
  "igpu",
  "led",
  "nvme",
  "pcie",
  "psu",
  "rgb",
  "ram",
  "rpm",
  "sata",
  "ssd",
  "tdp",
  "usb",
  "vram",
  "vrm",
]);

function humanizeKey(key: string): string {
  return key
    .replace(CAMEL_BOUNDARY, " $1")
    .replace(WORDS, (word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.replace(FIRST_CHARACTER, (character) => character.toUpperCase())
    );
}

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

/**
 * The label/value pairs a card shows, padded to `limit`.
 *
 * `headlineSpecs` renders the same fields as bare strings, which is right for
 * a one-line summary and wrong for a card that draws a label column. The
 * padding comes from `products.attributes` — display-only data the engine
 * ignores — because a card with one spec row and two empty ones reads as a
 * product nobody finished entering, and the attributes are usually the two
 * facts a buyer wanted anyway ("8GB GDDR6", "10C/16T").
 */
const MAX_SPEC_VALUE = 24;

export function headlineSpecRows(
  categorySlug: string | null,
  specs: ProductSpec | null,
  attributes: Record<string, unknown> | null,
  limit = 3
): SpecEntry[] {
  const fields = HEADLINE[categorySlug ?? ""] ?? [];
  const rows: SpecEntry[] = [];

  for (const field of fields) {
    const value = specs ? render(String(field), specs[field]) : null;

    if (value !== null) {
      rows.push({ label: LABELS[String(field)] ?? String(field), value });
    }
  }

  if (rows.length >= limit) {
    return rows.slice(0, limit);
  }

  const taken = new Set(rows.map((row) => row.label));

  for (const entry of attributeEntries(attributes)) {
    if (rows.length >= limit) {
      break;
    }

    /* A spec row is one value in a narrow column. An attribute holding a
       sentence — "the distributor publishes no dimensions" — is a real fact
       and belongs in the description, not wrapped over four lines of a card. */
    if (!taken.has(entry.label) && entry.value.length <= MAX_SPEC_VALUE) {
      rows.push(entry);
      taken.add(entry.label);
    }
  }

  return rows;
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
      label: humanizeKey(label),
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }))
    .filter((entry) => entry.value !== "" && entry.value !== "null");
}
