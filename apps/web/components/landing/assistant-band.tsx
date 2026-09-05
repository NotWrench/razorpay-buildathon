import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { PhotoGround } from "@/components/common/photo-ground";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { PrebuiltDetail, ProductSummary } from "@/lib/data/types";
import { landingImages } from "@/lib/landing-images";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 3 — full-bleed on --carbon, split 55/45.
 *
 * The agent is the reason this store exists, so it gets a band rather than a
 * mention: a real question, a real part, and the build peek underneath. One
 * product, but with enough around it to be worth looking at.
 */
interface AssistantBandProps {
  machine: PrebuiltDetail;
  pick: ProductSummary;
}

function AssistantBand({ machine, pick }: AssistantBandProps) {
  const partCount = machine.manifest.length;

  return (
    <section className="w-full bg-carbon py-24 lg:py-28">
      <div className="mx-auto grid w-full max-w-[1440px] gap-14 px-5 sm:px-8 lg:grid-cols-[55%_1fr] lg:px-10 2xl:px-16">
        <div>
          <Label>The assistant</Label>

          <p className="t-display-lg mt-6 max-w-[22ch] text-bone leading-[1.05]">
            “₹80,000, 1440p, mostly competitive shooters.”
          </p>
          <p className="t-body mt-5 max-w-[54ch] text-smoke">
            Then spend it on the card and the panel refresh, not the case. Here
            is what that looks like.
          </p>

          <div className="mt-9 flex items-center gap-5 py-5">
            <ImageGround className="size-14 shrink-0 p-2">
              {/* The catalogue's own photograph first — this band picks a real
                  product, and overriding a product's picture with a stock one
                  would be showing the buyer the wrong card. */}
              <ProductRender
                alt={pick.name}
                category={pick.category}
                sizes="56px"
                src={
                  pick.imageUrl ||
                  (landingImages.assistant.part.src ?? undefined)
                }
              />
            </ImageGround>
            <div className="min-w-0 flex-1">
              <p className="t-body truncate text-bone">{pick.name}</p>
              <p className="t-num-xs mt-1 text-smoke">
                {pick.keySpecs.map((spec) => spec.value).join(" · ")}
              </p>
            </div>
            <PriceBlock
              className="justify-end"
              pricePaise={pick.pricePaise}
              size="sm"
            />
          </div>

          <SpecList className="mt-8" rows={machine.headlineSpecs} />

          <div className="mt-5 flex items-baseline justify-between gap-6">
            <Label>Build total</Label>
            <span className="t-num-md text-bone">
              {formatPaise(machine.pricePaise)}
            </span>
          </div>

          <StatusLine
            className="mt-5"
            message={`All ${partCount} parts compatible.`}
            state="compatible"
          />

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <PillLink href={shellRoutes.prebuilt(machine.slug)} variant="ghost">
              See the full build
            </PillLink>
            <PillLink href={shellRoutes.assistant} variant="text">
              Try it yourself →
            </PillLink>
          </div>
        </div>

        {/*
          No aspect ratio here, deliberately. This is a grid item that stretches
          to the height the left column sets — about 665px against a 484px
          column, which is 0.73 to the photograph's 0.75. Stretching fits it
          better than any ratio we could name, and an `aspect-*` would be
          ignored on a stretched item anyway.

          `min-h-[420px]` is load-bearing: below `lg` the grid is one column,
          there is no sibling to stretch against, and the padding that used to
          give this box its height is gone. Without it the machine renders 0px
          tall on a phone.
        */}
        <PhotoGround
          alt={`${machine.name} tower`}
          category={landingImages.assistant.machine.category}
          className="aspect-[3/4] lg:aspect-auto lg:min-h-[420px]"
          fallbackClassName="p-12"
          sizes="(min-width: 1024px) 46vw, 90vw"
          src={landingImages.assistant.machine.src ?? undefined}
        />
      </div>
    </section>
  );
}

export { AssistantBand };
