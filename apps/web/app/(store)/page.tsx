import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Reveal } from "@workspace/ui/components/motion/reveal";
import type { Metadata } from "next";
import { PillLink } from "@/components/common/pill-link";
import { AssistantDock } from "@/components/dock/assistant-dock";
import { AssistantBand } from "@/components/landing/assistant-band";
import { ComponentBand } from "@/components/landing/component-band";
import { HeroBand } from "@/components/landing/hero-band";
import { UseCaseBand } from "@/components/landing/use-case-band";
import { WhyBand } from "@/components/landing/why-band";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { PrebuiltRows } from "@/components/product/prebuilt-row";
import { getPrebuilt, getPrebuilts, getProduct, getProducts } from "@/lib/data";
import { shellRoutes } from "@/lib/routes";

/**
 * The landing page — seven bands, alternating full-bleed image and contained
 * grid. Two contained grids never sit next to each other; that alternation is
 * what gives the page room without leaving it empty.
 *
 * Every count on this page is derived from the catalogue. Nothing is typed in.
 */

export const metadata: Metadata = {
  description:
    "Prebuilt machines and components, with a shopping agent that checks the parts fit before you buy.",
  title: "NEXUS — the store that checks the parts fit",
};

/** Which machines answer to which use case, read off the catalogue. */
const USE_CASES = [
  {
    category: "gpu",
    label: "Gaming",
    match: /gaming|esports/i,
    value: "gaming",
  },
  {
    category: "cpu",
    label: "Creator",
    match: /creation|creator/i,
    value: "creator",
  },
  {
    category: "motherboard",
    label: "Workstation",
    match: /workstation|cad/i,
    value: "workstation",
  },
  {
    category: "case",
    label: "Small form factor",
    match: /small form|sff/i,
    value: "sff",
  },
] as const;

/** 128px, stepping down at 1024 and 768. */
const SECTION = "mt-16 md:mt-[88px] lg:mt-32";

export default async function LandingPage() {
  const [products, prebuilts] = await Promise.all([
    getProducts(),
    getPrebuilts(),
  ]);

  /* The assistant band needs one real part to talk about, and the dearest
     card in stock is the one a shopper is most likely to be weighing up.
     Naming a fixed id here would break the day it sells out. */
  const [headline] = [...products]
    .filter(
      (product) =>
        product.category === "gpu" && product.stock !== "out_of_stock"
    )
    .sort((a, b) => b.pricePaise - a.pricePaise);

  const [pick, machine] = await Promise.all([
    headline ? getProduct(headline.id) : Promise.resolve(null),
    getPrebuilt(prebuilts.at(-1)?.slug ?? ""),
  ]);

  const useCaseTiles = USE_CASES.map((useCase) => ({
    category: useCase.category,
    label: useCase.label,
    machines: prebuilts.filter((prebuilt) =>
      prebuilt.useCases.some((entry) => useCase.match.test(entry))
    ).length,
    value: useCase.value,
  }));

  const categoryTiles = CATEGORY_DEFINITIONS.slice(0, 6).map((definition) => ({
    count: products.filter((product) => product.category === definition.slug)
      .length,
    name: definition.name,
    slug: definition.slug,
  }));

  const lineup = prebuilts.slice(0, 3);

  return (
    <>
      <ScrollProgress />

      <HeroBand
        categoryCount={CATEGORY_DEFINITIONS.length}
        partCount={products.length}
      />

      <Reveal className={SECTION}>
        <UseCaseBand tiles={useCaseTiles} />
      </Reveal>

      {machine && pick ? (
        <Reveal className={SECTION}>
          <AssistantBand machine={machine} pick={pick} />
        </Reveal>
      ) : null}

      <Reveal className={SECTION}>
        <section className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
          <Label>The lineup</Label>
          <h2 className="mt-4 max-w-[24ch] font-display font-semibold text-[28px] text-bone tracking-[-0.02em]">
            {prebuilts.length} machines, each built for one kind of evening.
          </h2>

          {/* No primary row here. The hero owns this page's one filled pill;
              the listing at /prebuilts is where a machine gets to be the
              recommended one. Two solid reds on one page is one too many. */}
          <PrebuiltRows
            className="mt-8 border-hairline border-t"
            prebuilts={lineup}
          />

          <div className="mt-10 flex justify-center">
            <PillLink href={shellRoutes.prebuilts} variant="text">
              All {prebuilts.length} models →
            </PillLink>
          </div>
        </section>
      </Reveal>

      <Reveal className={SECTION}>
        <ComponentBand
          tiles={categoryTiles}
          totalCategories={CATEGORY_DEFINITIONS.length}
        />
      </Reveal>

      <Reveal className={SECTION}>
        <WhyBand />
      </Reveal>

      <AssistantDock context={{ page: "home" }} />
    </>
  );
}
