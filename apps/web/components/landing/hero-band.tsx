import { ImageGround } from "@workspace/ui/components/image-ground";
import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 1 — full-bleed, 92vh.
 *
 * The render fills the right two-thirds and bleeds off the edge; a scrim
 * darkens the left third so the headline sits on something, not over detail.
 * The only loop on the page lives here.
 */
interface HeroBandProps {
  categoryCount: number;
  partCount: number;
}

function HeroBand({ categoryCount, partCount }: HeroBandProps) {
  return (
    <section className="relative flex h-[92vh] min-h-[560px] w-full items-center overflow-hidden bg-void">
      <div className="absolute inset-y-0 right-0 w-full lg:w-2/3">
        <KenBurns className="h-full w-full">
          <ImageGround className="h-full w-full rounded-none p-16">
            <ProductRender alt="The MERIDIAN tower" category="case" />
          </ImageGround>
        </KenBurns>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,#060606_0%,#060606_34%,rgba(6,6,6,0.72)_52%,rgba(6,6,6,0)_78%)]"
      />

      <div className="relative mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        {/*
          The plan budgets "one accent in the hero" and it was never drawn.
          A short lacquer rule above the headline is an accent, not a border —
          it outlines nothing and encloses nothing.
        */}
        <span aria-hidden className="block h-0.5 w-10 rounded-full bg-lacquer" />

        <h1 className="t-display-xl mt-7 max-w-[13ch] text-[clamp(44px,5.6vw,76px)] text-bone leading-[0.98]">
          The store that checks the parts fit.
        </h1>
        <p className="t-body-lg mt-7 max-w-[46ch] text-smoke">
          Tell it the budget and the games. It reads the catalogue, runs the
          compatibility rules, and shows the working.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <PillLink href={shellRoutes.assistant}>Ask the assistant</PillLink>
          <PillLink href={shellRoutes.prebuilts} variant="ghost">
            Shop prebuilts
          </PillLink>
        </div>
      </div>

      <p className="t-num-xs absolute bottom-10 left-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-smoke lg:left-16">
        <span className="text-bone">{categoryCount} categories</span>
        <span aria-hidden>·</span>
        <span className="text-bone">{partCount} parts</span>
        <span aria-hidden>·</span>
        <span>compatibility checked on every build</span>
      </p>
    </section>
  );
}

export { HeroBand };
