import { ImageGround } from "@workspace/ui/components/image-ground";
import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import Image from "next/image";
import { ProductRender } from "@/components/common/product-render";
import { UseCaseFilter } from "@/components/prebuilt/use-case-filter";
import { PrebuiltRow } from "@/components/product/prebuilt-row";
import { getPrebuilts } from "@/lib/data";
import { landingImages } from "@/lib/landing-images";

/**
 * The four machines, one per row, at ORIGIN's density: two and a bit fill a
 * viewport. Generosity per product, not minimalism.
 *
 * The use-case filter lives in the query string and is read here on the
 * server — see the shop for why a page's own client tree must not read URL
 * data itself.
 */

export const metadata: Metadata = {
  description:
    "Four machines, built and validated by the compatibility engine before they ship.",
  title: "Prebuilt systems",
};

type SearchParams = Promise<{ use?: string | string[] }>;

/** Which machines answer to which use case, matched against the fixtures. */
const MATCHERS: Record<string, RegExp> = {
  creator: /creation|creator/i,
  gaming: /gaming|esports/i,
  sff: /small form|sff/i,
  workstation: /workstation|cad/i,
};

export default async function PrebuiltsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = (await searchParams).use;
  const use = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const matcher = MATCHERS[use];

  const all = await getPrebuilts();
  const machines = matcher
    ? all.filter((machine) =>
        machine.useCases.some((entry) => matcher.test(entry))
      )
    : all;

  return (
    <div>
      {/*
          A banner is the one slot where cropping is the point: a 3:1 studio
          shot into a band this wide keeps the middle and loses the top and
          bottom, which is what a banner does. The height grows with the
          viewport so that crop, and the upscale that comes with it, both ease
          off on a wide screen.
        */}
      <section className="relative h-[260px] w-full overflow-hidden sm:h-[300px] lg:h-[340px] xl:h-[380px]">
        <KenBurns className="h-full w-full">
          <ImageGround
            className={cn(
              "h-full w-full rounded-none",
              landingImages.pageHero.prebuilts.src ? undefined : "p-6"
            )}
          >
            {/* One photograph, or — until it exists — the three drawings this
                band has always shown. Three of the same outline in a row is a
                placeholder; a photograph of a shelf of machines is the band. */}
            {landingImages.pageHero.prebuilts.src ? (
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="100vw"
                src={landingImages.pageHero.prebuilts.src}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-16 opacity-80">
                <ProductRender alt="" category="case" />
                <ProductRender alt="" category="case" />
                <ProductRender alt="" category="case" />
              </div>
            )}
          </ImageGround>
        </KenBurns>
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--void)_30%,transparent)_45%,color-mix(in_srgb,var(--void)_94%,transparent)_100%)]"
        />
      </section>

      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        <div className="relative -mt-16">
          <h1 className="t-display-lg text-bone leading-none">
            Prebuilt systems
          </h1>
          <p className="t-body-lg mt-4 max-w-[52ch] text-smoke">
            Built, tested and validated by the compatibility engine.
          </p>
        </div>

        <div className="mt-10">
          <UseCaseFilter active={use} />
        </div>

        {machines.length === 0 ? (
          <p className="t-body-lg py-24 text-bone">
            No machine is built for that yet.
          </p>
        ) : (
          <Stagger className="mt-12" key={use}>
            {machines.map((machine, index) => (
              <PrebuiltRow
                key={machine.slug}
                prebuilt={machine}
                primary={index === 0}
              />
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
