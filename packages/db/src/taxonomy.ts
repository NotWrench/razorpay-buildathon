/**
 * The canonical component taxonomy, in one place.
 *
 * The seed writes these rows, the compatibility engine reads the slugs, and
 * the storefront groups by them. Keeping the list here rather than duplicating
 * it in each consumer means a new category is added once and every reader
 * agrees about what it is.
 */

/** Every category slug the platform knows about. */
export const CATEGORY_SLUGS = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "storage",
  "psu",
  "case",
  "cooler",
  "fan",
  "monitor",
  "peripheral",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

/** Slots a build can fill. A slot maps one-to-one onto a component category. */
export type BuildSlot = Extract<
  CategorySlug,
  | "cpu"
  | "motherboard"
  | "ram"
  | "gpu"
  | "storage"
  | "psu"
  | "case"
  | "cooler"
  | "fan"
>;

export interface CategoryDefinition {
  buildSlot: BuildSlot | null;
  isBuildComponent: boolean;
  /** Null means unlimited. */
  maxPerBuild: number | null;
  /** Zero means the slot is optional. */
  minPerBuild: number;
  name: string;
  slug: CategorySlug;
  sortOrder: number;
}

/**
 * `minPerBuild` is what a build genuinely cannot boot without.
 *
 * A GPU is optional because an integrated-graphics build is a real build; a
 * cooler is optional because many CPUs ship with one. Marking either as
 * required would make `build_completeness` fire on configurations that are
 * perfectly valid, and a rule that cries wolf gets ignored.
 */
export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    buildSlot: "cpu",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 1,
    name: "Processors",
    slug: "cpu",
    sortOrder: 10,
  },
  {
    buildSlot: "motherboard",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 1,
    name: "Motherboards",
    slug: "motherboard",
    sortOrder: 20,
  },
  {
    buildSlot: "ram",
    isBuildComponent: true,
    maxPerBuild: 4,
    minPerBuild: 1,
    name: "Memory",
    slug: "ram",
    sortOrder: 30,
  },
  {
    buildSlot: "gpu",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 0,
    name: "Graphics Cards",
    slug: "gpu",
    sortOrder: 40,
  },
  {
    buildSlot: "storage",
    isBuildComponent: true,
    maxPerBuild: 4,
    minPerBuild: 1,
    name: "Storage",
    slug: "storage",
    sortOrder: 50,
  },
  {
    buildSlot: "psu",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 1,
    name: "Power Supplies",
    slug: "psu",
    sortOrder: 60,
  },
  {
    buildSlot: "case",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 1,
    name: "Cases",
    slug: "case",
    sortOrder: 70,
  },
  {
    buildSlot: "cooler",
    isBuildComponent: true,
    maxPerBuild: 1,
    minPerBuild: 0,
    name: "CPU Coolers",
    slug: "cooler",
    sortOrder: 80,
  },
  {
    buildSlot: "fan",
    isBuildComponent: true,
    maxPerBuild: 8,
    minPerBuild: 0,
    name: "Case Fans",
    slug: "fan",
    sortOrder: 90,
  },
  {
    buildSlot: null,
    isBuildComponent: false,
    maxPerBuild: null,
    minPerBuild: 0,
    name: "Monitors",
    slug: "monitor",
    sortOrder: 100,
  },
  {
    buildSlot: null,
    isBuildComponent: false,
    maxPerBuild: null,
    minPerBuild: 0,
    name: "Peripherals",
    slug: "peripheral",
    sortOrder: 110,
  },
];

const bySlug = new Map(
  CATEGORY_DEFINITIONS.map((definition) => [definition.slug, definition])
);

export function getCategoryDefinition(
  slug: string
): CategoryDefinition | undefined {
  return bySlug.get(slug as CategorySlug);
}

export function isCategorySlug(value: string): value is CategorySlug {
  return bySlug.has(value as CategorySlug);
}

/** Slots a build must fill before it can be checked out. */
export const REQUIRED_BUILD_SLOTS: BuildSlot[] = CATEGORY_DEFINITIONS.filter(
  (definition) => definition.minPerBuild > 0 && definition.buildSlot !== null
).map((definition) => definition.buildSlot as BuildSlot);
