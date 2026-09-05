import { Label } from "@workspace/ui/components/label";
import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { PhotoGround } from "@/components/common/photo-ground";
import { ModelActions } from "@/components/prebuilt/model-actions";
import type { PrebuiltDetail } from "@/lib/data/types";
import { machineImage } from "@/lib/landing-images";

/**
 * Band 1. The machine, its one line of positioning, and the only solid red
 * pill on the page.
 */
function ModelHero({
  machine,
  slug,
}: {
  machine: PrebuiltDetail;
  slug: string;
}) {
  return (
    <section className="relative flex w-full items-center overflow-hidden lg:min-h-[720px]">
      {/*
        480 x 720 is exactly 2:3, which is exactly the shape of a machine shot,
        so this panel crops nothing at any viewport width.

        Both numbers are fixed on purpose. A percentage width inside a band
        whose height comes from its own text gives you a ratio nobody chose —
        this band's content is about 604px tall, so a 48% panel would land near
        square and take a third off the height of a tower. Pinning the band to
        720px and the panel to 480px is what makes the fit exact; `items-center`
        on the section keeps the shorter text block centred in the taller band.

        machine.slug, not the `slug` prop — that one is the store's, and it is
        what ModelActions posts to.
      */}
      <div className="absolute inset-0 overflow-hidden lg:right-0 lg:left-auto lg:w-[480px]">
        <KenBurns className="h-full w-full">
          <PhotoGround
            alt={`${machine.name} tower`}
            category="case"
            className="h-full w-full rounded-none"
            fallbackClassName="p-10"
            sizes="(min-width: 1024px) 480px, 100vw"
            src={machineImage(machine.slug)}
          />
        </KenBurns>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,var(--void)_0%,var(--void)_38%,color-mix(in_srgb,var(--void)_70%,transparent)_54%,transparent_78%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-8 py-28 lg:max-w-[1280px] lg:px-16 lg:py-36">
        <div className="lg:max-w-[46%]">
          <h1 className="t-model text-[clamp(30px,5vw,50px)] text-bone">
            {machine.name}
          </h1>
          <p className="t-body-lg mt-6 max-w-[40ch] text-smoke">
            {machine.tagline}
          </p>

          <div className="mt-8 flex items-center gap-2.5">
            <Label className="mr-2">Finish</Label>
            {machine.colourways.map((colourway) => (
              <span
                className="size-[15px] rounded-full border border-hairline"
                key={colourway.name}
                style={{ backgroundColor: colourway.hex }}
                title={colourway.name}
              />
            ))}
          </div>

          <PriceBlock
            className="mt-8"
            compareAtPaise={machine.compareAtPaise}
            pricePaise={machine.pricePaise}
            size="lg"
          />

          <ModelActions
            name={machine.name}
            productIds={machine.manifest.map((entry) => entry.product.id)}
            slug={slug}
          />
        </div>
      </div>
    </section>
  );
}

export { ModelHero };
