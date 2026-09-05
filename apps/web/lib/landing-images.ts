import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CategorySlug } from "@workspace/db/taxonomy";

/**
 * The site's own photography, in one place.
 *
 * Not landing-only any more, despite the filename: the model pages, the
 * listings, the shop heroes and the auth screen all draw from here too. What
 * unites them is that these are pictures *we* commission, as opposed to the
 * catalogue photographs that arrive on a product row from `image_url`. Those
 * stay where they are; this file never overrides one.
 *
 * Every visual slot here used to be a `<ProductRender>` with a category and no
 * `src` — the inline line drawing, standing in for a photograph that did not
 * exist because the repo had no `public/` directory at all. This is that
 * directory's index.
 *
 * **Adding an image is one step: put the file in `apps/web/public/landing/`
 * under the name below.** Nothing here needs editing. Every slot declares the
 * filename it wants and `shot()` checks whether that file is actually on disk;
 * if it is not, the slot reports no source and the component draws its line
 * render exactly as it did before there were any photographs at all.
 *
 * **This module is server-only.** The check is a `node:fs` call at module
 * scope, so importing it from a `"use client"` file fails the build with
 * "the chunking context does not support external modules (request: node:fs)".
 * That is the correct failure — a browser has no filesystem to ask — and the
 * fix is never to drop the check but to resolve the slot in the server
 * component that owns the page and pass the `src` down as a prop. The shop
 * band, the auth screen and the model gallery are all client components and
 * are wired that way.
 *
 * The alternative was a hand-maintained `src: null` per slot, whose failure
 * mode is a broken image icon shipped to production because someone renamed a
 * file.
 *
 * `category` is not a fallback so much as the *other* half of the slot: it is
 * what the line render draws, and it stays correct whether or not a photograph
 * ever lands.
 */

interface LandingImage {
  /** Alt text. Describes the subject, not the fact that it is an image. */
  alt: string;
  /** What the line render draws when the file is absent. */
  category: CategorySlug;
  /** `/landing/<file>` when that file exists on disk, otherwise null. */
  src: string | null;
}

const LANDING_DIR = join(process.cwd(), "public", "landing");

/**
 * A slot, resolved against the filesystem.
 *
 * `existsSync` runs once per slot at import, not per render — this module is
 * evaluated a single time per server process, so seventeen stats is a one-off
 * cost at boot rather than anything a request pays for.
 */
function shot(file: string, alt: string, category: CategorySlug): LandingImage {
  return {
    alt,
    category,
    src: existsSync(join(LANDING_DIR, file)) ? `/landing/${file}` : null,
  };
}

/* The hero. Fills the right two-thirds of a 92vh band and bleeds off the right
   edge, under a scrim that darkens the left third. */
const hero = shot("hero-tower.jpg", "The MERIDIAN tower", "case");

/* The four "shop by use" tiles, 4:3. Keys are the `value` field of USE_CASES
   in app/(store)/page.tsx. */
const useCase: Record<string, LandingImage> = {
  creator: shot("use-creator.jpg", "Creator", "cpu"),
  gaming: shot("use-gaming.jpg", "Gaming", "gpu"),
  sff: shot("use-sff.jpg", "Small form factor", "case"),
  workstation: shot("use-workstation.jpg", "Workstation", "motherboard"),
};

/*
 * The assistant band's two frames. The thumbnail sits inline beside a part
 * name at 56px; the machine is a tall panel down the right-hand side.
 *
 * `part` is only reached when the product the band picked has no photograph of
 * its own — the band names a real product off the catalogue, and showing a
 * stock image over a real one would be showing the buyer the wrong card.
 */
const assistant: Record<"machine" | "part", LandingImage> = {
  machine: shot("assistant-machine.jpg", "The machine, assembled", "case"),
  part: shot("assistant-part.jpg", "", "gpu"),
};

/* The six "shop by component" tiles, 4:3, keyed by category slug — the first
   six of CATEGORY_DEFINITIONS, which is what the band slices. */
const component: Partial<Record<CategorySlug, LandingImage>> = {
  cpu: shot("part-cpu.jpg", "Processors", "cpu"),
  gpu: shot("part-gpu.jpg", "Graphics cards", "gpu"),
  motherboard: shot("part-motherboard.jpg", "Motherboards", "motherboard"),
  psu: shot("part-psu.jpg", "Power supplies", "psu"),
  ram: shot("part-ram.jpg", "Memory", "ram"),
  storage: shot("part-storage.jpg", "Storage", "storage"),
};

/*
 * One shot per prebuilt machine, keyed by slug.
 *
 * The most reused set on the site: the lineup band on the landing page, the
 * listing at /prebuilts, and the hero of every model page all draw the same
 * machine. Until these files exist, all four machines are illustrated by the
 * same line drawing — four different products, one picture.
 *
 * Portrait, because a tower is. The lineup crops to 4:3 and the model hero to
 * a wide band, so the subject wants to be centred with room top and bottom.
 */
const machine: Record<string, LandingImage> = {
  arc: shot("machine-arc.jpg", "The ARC tower", "case"),
  meridian: shot("machine-meridian.jpg", "The MERIDIAN tower", "case"),
  orbit: shot("machine-orbit.jpg", "The ORBIT tower", "case"),
  volt: shot("machine-volt.jpg", "The VOLT tower", "case"),
};

/** The four machines, in the order the recipes declare them. */
const MACHINE_SLUGS = ["arc", "volt", "meridian", "orbit"] as const;

/*
 * Each machine's gallery — three shots of that machine, per model page.
 *
 * This used to be fed from the catalogue: the three photographs of the first
 * three parts in the recipe. Which meant the gallery of a finished machine was
 * a picture of a memory kit, a picture of a drive and a picture of a power
 * supply — parts the manifest table lists directly underneath, in words, more
 * usefully. A gallery of a machine should be the machine.
 *
 * Until a machine's three files exist it shows nothing at all rather than
 * falling back to a line drawing: three identical outlines of a generic case
 * is not a gallery, and the model hero above it is already showing that
 * drawing.
 */
const machineGallery: Record<string, string[]> = Object.fromEntries(
  MACHINE_SLUGS.map((slug) => [
    slug,
    [1, 2, 3]
      .map((n) => shot(`machine-${slug}-${n}.jpg`, "", "case").src)
      .filter((src): src is string => src !== null),
  ])
);

/*
 * The two feature bands on each model page — the image half of the alternating
 * image/copy rows. Each one illustrates a specific claim in that machine's
 * copy, so they are per-machine rather than a shared set of stock details.
 */
const feature: Record<string, LandingImage[]> = Object.fromEntries(
  MACHINE_SLUGS.map((slug) => [
    slug,
    [1, 2].map((n) => shot(`feature-${slug}-${n}.jpg`, "", "case")),
  ])
);

/*
 * Page heroes — the wide bands at the top of a listing or a form, which were
 * drawing two or three line renders side by side at 80% opacity under a scrim.
 * That reads as a placeholder because it was one.
 */
const pageHero = {
  auth: shot("hero-auth.jpg", "", "case"),
  components: shot("hero-components.jpg", "", "gpu"),
  prebuilts: shot("hero-prebuilts.jpg", "", "case"),
} as const;

/*
 * One hero per category page. `/shop/gpu` and `/shop/cooler` are different
 * shops and should not open on the same picture.
 */
const CATEGORY_SLUGS = [
  "case",
  "cooler",
  "cpu",
  "fan",
  "gpu",
  "monitor",
  "motherboard",
  "peripheral",
  "psu",
  "ram",
  "storage",
] as const;

const categoryHero: Partial<Record<CategorySlug, LandingImage>> =
  Object.fromEntries(
    CATEGORY_SLUGS.map((slug) => [slug, shot(`hero-cat-${slug}.jpg`, "", slug)])
  );

/** The machine shot for a slug, or undefined when that file is not there. */
function machineImage(slug: string): string | undefined {
  return machine[slug]?.src ?? undefined;
}

/** A machine's gallery. Empty until its three shots exist. */
function machineGalleryFor(slug: string): string[] {
  return machineGallery[slug] ?? [];
}

/** The image for feature band `index` of a machine, if it has been shot. */
function featureImage(slug: string, index: number): LandingImage | undefined {
  return feature[slug]?.[index];
}

const landingImages = {
  assistant,
  categoryHero,
  component,
  feature,
  hero,
  machine,
  machineGallery,
  pageHero,
  useCase,
};

export type { LandingImage };
export { featureImage, landingImages, machineGalleryFor, machineImage };
