import type { BuildComponent } from "@workspace/commerce/compatibility";
import { estimateWattage } from "@workspace/commerce/compatibility";
import {
  db,
  inventory,
  type Product,
  type ProductSpec,
  productSpecs,
  products,
} from "@workspace/db";
import { isCategorySlug } from "@workspace/db/taxonomy";
import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { reportFor } from "./compatibility";
import { toSummary } from "./product";
import { storeId } from "./store";
import type {
  Colourway,
  CompatibilityState,
  PrebuiltDetail,
  PrebuiltSummary,
  PrebuiltTier,
  ProductSummary,
  SpecRow,
} from "./types";

/**
 * The machines, assembled from the catalogue the store actually holds.
 *
 * There is no prebuilts table, and there should not be one yet: a prebuilt is
 * a *selection* of parts plus the words a shop puts around it, and only the
 * second half is content. So the recipes below name real SKUs, and everything
 * a buyer could check — price, the parts list, the wattage, the compatibility
 * verdict per row — is read or computed from those parts rather than typed in.
 *
 * That constraint is what keeps the page honest. A machine whose recipe names
 * a SKU the merchant has delisted does not render with a stale price; it does
 * not render at all, and `/prebuilts` is shorter until somebody fixes the
 * recipe.
 */

const GRAPHITE: Colourway = { hex: "#1C1C1C", name: "Graphite" };
const BONE: Colourway = { hex: "#E8E4DE", name: "Bone" };
const LACQUER: Colourway = { hex: "#8C1226", name: "Lacquer" };

/** A slot in the recipe, and the SKU that fills it. */
interface RecipePart {
  sku: string;
  slot: string;
}

interface FeatureCopy {
  body: string;
  /**
   * The one measured claim the section rests on, written as a function of the
   * resolved parts. A section whose fact were a literal could outlive the
   * parts it describes; this one cannot.
   */
  fact: (context: FactContext) => string;
  heading: string;
}

interface FactContext {
  estimatedWattage: number;
  part: (slot: string) => ProductSummary | undefined;
  psuWattage: number;
  spec: (slot: string, label: string) => string | undefined;
}

interface Recipe {
  colourways: Colourway[];
  features: FeatureCopy[];
  name: string;
  parts: RecipePart[];
  slug: string;
  tagline: string;
  tier: PrebuiltTier;
  useCases: string[];
}

const RECIPES: Recipe[] = [
  {
    colourways: [GRAPHITE, BONE],
    features: [
      {
        body: "A six-core chip and a card sized to match it. Neither is waiting on the other, which is what keeps a frame rate steady rather than spiky.",
        fact: (context) =>
          `${context.spec("Processor", "Socket") ?? "AM5"} · ${
            context.spec("Graphics", "TDP") ?? ""
          } card`.trim(),
        heading: "Balanced, not bottlenecked",
      },
      {
        body: "The supply is sized against the parts, not against the marketing. The margin below is what the compatibility engine measured, not a number somebody rounded up to.",
        fact: (context) =>
          `${context.estimatedWattage} W estimated draw · ${context.psuWattage} W supply`,
        heading: "Sized, then checked",
      },
    ],
    name: "ARC",
    parts: [
      { sku: "CPU-AMD-R5-7600", slot: "Processor" },
      { sku: "MBD-ASUS-B650M-PLUS", slot: "Motherboard" },
      { sku: "RAM-KING-16-5600", slot: "Memory" },
      { sku: "GPU-ZOT-4060", slot: "Graphics" },
      { sku: "SSD-WD-SN770-1T", slot: "Storage" },
      { sku: "PSU-MSI-A650BN", slot: "Power supply" },
      { sku: "CSE-DEEP-CH370", slot: "Case" },
      { sku: "COL-DEEP-AK400", slot: "Cooling" },
    ],
    slug: "arc",
    tagline: "Everything that matters. Nothing that doesn't.",
    tier: "entry",
    useCases: ["1080p gaming", "First build", "Streaming"],
  },
  {
    colourways: [GRAPHITE, LACQUER, BONE],
    features: [
      {
        body: "The 3D cache is the reason competitive titles hold their frame rate at 1440p. This is the part of the machine that decides the round.",
        fact: (context) =>
          `${context.part("Processor")?.name ?? ""} · ${
            context.spec("Processor", "TDP") ?? ""
          }`.trim(),
        heading: "Frames where they count",
      },
      {
        body: "Airflow case, tower cooler, and enough clearance that neither is fighting the other. The figures below are the case's, measured against the card that goes in it.",
        fact: (context) =>
          `${context.spec("Graphics", "Length") ?? ""} card in ${
            context.spec("Case", "Max GPU length") ?? ""
          } of clearance`.trim(),
        heading: "Room to breathe",
      },
    ],
    name: "VOLT",
    parts: [
      { sku: "CPU-AMD-R7-7800X3D", slot: "Processor" },
      { sku: "MBD-MSI-B650-TMHK", slot: "Motherboard" },
      { sku: "RAM-CORS-32-6000", slot: "Memory" },
      { sku: "GPU-ASUS-4070S", slot: "Graphics" },
      { sku: "SSD-SAMS-990P-2T", slot: "Storage" },
      { sku: "PSU-CORS-RM750E", slot: "Power supply" },
      { sku: "CSE-CORS-4000D", slot: "Case" },
      { sku: "COL-THRM-PA120", slot: "Cooling" },
    ],
    slug: "volt",
    tagline: "Built for the round you are losing by four frames.",
    tier: "esports",
    useCases: ["1440p gaming", "Esports", "Streaming"],
  },
  {
    colourways: [GRAPHITE, BONE],
    features: [
      {
        body: "Twelve cores and sixty-four gigabytes, which is the pairing that stops a timeline from stuttering when the render is still going.",
        fact: (context) =>
          `${context.spec("Memory", "Capacity") ?? ""} ${
            context.spec("Memory", "Memory type") ?? ""
          } · ${context.spec("Processor", "Socket") ?? ""}`.trim(),
        heading: "Enough for the second application",
      },
      {
        body: "A 360 mm loop over a 170 W processor, in a case with the clearance for both. Nothing here is at the edge of its rating.",
        fact: (context) =>
          `${context.estimatedWattage} W estimated draw · ${context.psuWattage} W supply`,
        heading: "Quiet under a long render",
      },
    ],
    name: "MERIDIAN",
    parts: [
      { sku: "CPU-AMD-R9-7900X", slot: "Processor" },
      { sku: "MBD-GIGA-X670E-ELITE", slot: "Motherboard" },
      { sku: "RAM-CORS-64-6000", slot: "Memory" },
      { sku: "GPU-GIGA-4070TIS", slot: "Graphics" },
      { sku: "SSD-SAMS-990P-2T", slot: "Storage" },
      { sku: "PSU-CORS-RM850X", slot: "Power supply" },
      { sku: "CSE-LIAN-L216", slot: "Case" },
      { sku: "COL-ARCT-LF3-360", slot: "Cooling" },
    ],
    slug: "meridian",
    tagline: "For the work that does not stop when the render starts.",
    tier: "creator",
    useCases: ["Content creation", "Workstation", "CAD"],
  },
  {
    colourways: [GRAPHITE, BONE],
    features: [
      {
        body: "An ITX board, an SFX supply and the shortest card in the store. Small is a set of measurements, not a compromise you find out about later.",
        fact: (context) =>
          `${context.spec("Case", "Form factor") ?? "ITX"} · ${
            context.spec("Graphics", "Length") ?? ""
          } card`.trim(),
        heading: "Small on purpose",
      },
      {
        body: "Two memory slots and two M.2 sockets is what an ITX board gives you, and the build is specified to sit inside that rather than to fill it.",
        fact: (context) =>
          `${context.spec("Motherboard", "Memory slots") ?? ""} memory slots · ${
            context.spec("Motherboard", "M.2 slots") ?? ""
          } M.2`.trim(),
        heading: "Specified to the slots it has",
      },
    ],
    name: "ORBIT",
    parts: [
      { sku: "CPU-AMD-R5-8600G", slot: "Processor" },
      { sku: "MBD-ASRK-B650E-ITX", slot: "Motherboard" },
      { sku: "RAM-GSKL-32-6400", slot: "Memory" },
      { sku: "GPU-SAPP-7600", slot: "Graphics" },
      { sku: "SSD-CRUC-P3P-2T", slot: "Storage" },
      { sku: "PSU-CORS-SF750", slot: "Power supply" },
      { sku: "CSE-CLRM-NR200P", slot: "Case" },
      { sku: "COL-DEEP-AK400", slot: "Cooling" },
    ],
    slug: "orbit",
    tagline: "The whole machine, on the desk rather than under it.",
    tier: "enthusiast",
    useCases: ["Small form factor", "1440p gaming", "Living room"],
  },
];

/**
 * A loaded row, as the compatibility engine takes it.
 *
 * `loadBuildComponents` would do this from the database, but every field it
 * needs — the category and the spec row — is already in hand from the one
 * query above, and calling it per recipe would be four round trips for
 * information nobody has to fetch twice.
 */
function toComponent(row: {
  product: Product;
  specs: ProductSpec | null;
}): BuildComponent | null {
  const { product } = row;
  const { category } = product;

  if (!(category && isCategorySlug(category))) {
    return null;
  }

  return {
    categorySlug: category,
    name: product.name,
    productId: product.id,
    quantity: 1,
    specs: row.specs,
  };
}

/** The four headline rows, in the order the card prints them. */
const HEADLINE_SLOTS = ["Processor", "Graphics", "Memory", "Storage"] as const;

/** How many shots a model page's gallery shows. One row of three. */
const GALLERY_VIEWS = 3;

interface Resolved {
  detail: PrebuiltDetail;
  recipe: Recipe;
}

/**
 * Every recipe whose parts all still exist, priced and validated.
 *
 * One query for the whole page rather than one per machine: four recipes over
 * eight slots is thirty-two lookups done as a single `in (…)`.
 */
const resolveAll = cache(async (): Promise<Resolved[]> => {
  const merchantId = await storeId();
  const skus = [
    ...new Set(RECIPES.flatMap((recipe) => recipe.parts.map((p) => p.sku))),
  ];

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
      and(eq(products.merchantId, merchantId), inArray(products.sku, skus))
    );

  const bySku = new Map(
    rows.map((row) => [
      row.product.sku ?? "",
      { ...row, summary: toSummary(row) },
    ])
  );

  const resolved: Resolved[] = [];

  for (const recipe of RECIPES) {
    const parts = recipe.parts.map((part) => ({
      row: bySku.get(part.sku),
      slot: part.slot,
    }));

    if (parts.some((part) => part.row === undefined)) {
      /* A recipe the catalogue can no longer fill is not shown. See the note
         at the top of the file: a half-priced machine is worse than none. */
      continue;
    }

    const components = parts
      .map((part) => toComponent(part.row as NonNullable<typeof part.row>))
      .filter((component): component is BuildComponent => component !== null);

    const report = reportFor(components);
    const wattage = estimateWattage(components);
    const psuWattage =
      parts.find((part) => part.slot === "Power supply")?.row?.specs
        ?.psuWattage ?? 0;

    const summaries = parts.map((part) => ({
      product: (part.row as NonNullable<typeof part.row>).summary,
      slot: part.slot,
    }));

    const partFor = (slot: string) =>
      summaries.find((entry) => entry.slot === slot)?.product;

    const specValue = (slot: string, label: string) =>
      partFor(slot)?.keySpecs.find((row) => row.label === label)?.value;

    const context: FactContext = {
      estimatedWattage: wattage.watts,
      part: partFor,
      psuWattage,
      spec: specValue,
    };

    /* Per-row state: the rule that names this part, if one fired. */
    const stateByProduct = new Map<string, CompatibilityState>();

    for (const check of report.checks) {
      for (const related of check.relatedProducts ?? []) {
        const current = stateByProduct.get(related.id);

        if (!current || current === "compatible") {
          stateByProduct.set(related.id, check.state);
        }
      }
    }

    const heroImageUrl = partFor("Case")?.imageUrl ?? "";
    const pricePaise = summaries.reduce(
      (total, entry) => total + entry.product.pricePaise,
      0
    );

    resolved.push({
      detail: {
        colourways: recipe.colourways,
        estimatedWattage: wattage.watts,
        features: recipe.features.map((feature) => ({
          body: feature.body,
          fact: feature.fact(context),
          heading: feature.heading,
          imageUrl: heroImageUrl,
        })),
        headlineSpecs: HEADLINE_SLOTS.map((slot) => ({
          label: slot,
          value: partFor(slot)?.name ?? "—",
        })),
        heroImageUrl,
        /* Three. A recipe has eight parts and showing all eight turned the
           gallery into a parts list the manifest below already gives you,
           twice as well. Three is a row, and a row reads as a gallery. */
        images: summaries
          .map((entry) => entry.product.imageUrl)
          .filter((url) => url !== "")
          .slice(0, GALLERY_VIEWS),
        manifest: summaries.map((entry) => ({
          product: entry.product,
          slot: entry.slot,
          state: stateByProduct.get(entry.product.id),
        })),
        name: recipe.name,
        pricePaise,
        psuRatedWattage: psuWattage,
        slug: recipe.slug,
        specGroups: specGroupsFor(specValue, wattage.watts, psuWattage),
        tagline: recipe.tagline,
        tier: recipe.tier,
        useCases: recipe.useCases,
      },
      recipe,
    });
  }

  return resolved;
});

function specGroupsFor(
  spec: (slot: string, label: string) => string | undefined,
  estimatedWattage: number,
  psuWattage: number
): { rows: SpecRow[]; title: string }[] {
  const platform: SpecRow[] = [
    { label: "Socket", value: spec("Processor", "Socket") ?? "—" },
    { label: "Chipset", value: spec("Motherboard", "Chipset") ?? "—" },
    { label: "Form factor", value: spec("Motherboard", "Form factor") ?? "—" },
    { label: "Memory type", value: spec("Memory", "Memory type") ?? "—" },
  ].filter((row) => row.value !== "—");

  return [
    { rows: platform, title: "Platform" },
    {
      rows: [
        { label: "Estimated draw", value: `${estimatedWattage} W` },
        { label: "Supply", value: `${psuWattage} W` },
      ],
      title: "Power",
    },
    {
      rows: [
        { label: "Warranty", value: "3 years" },
        { label: "Build time", value: "5 working days" },
      ],
      title: "Ownership",
    },
  ];
}

export async function getPrebuilts(): Promise<PrebuiltSummary[]> {
  return (await resolveAll()).map((entry) => entry.detail);
}

export async function getPrebuilt(
  slug: string
): Promise<PrebuiltDetail | null> {
  const found = (await resolveAll()).find(
    (entry) => entry.detail.slug === slug
  );

  return found?.detail ?? null;
}
