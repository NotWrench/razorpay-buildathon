import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { PhotoGround } from "@/components/common/photo-ground";
import { PillLink } from "@/components/common/pill-link";
import { landingImages } from "@/lib/landing-images";
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
      {/*
        The tower stands in a panel on the right, and the panel is sized so the
        photograph fills it without being cropped.

        `73.6vh` is that width exactly: the picture is 4:5, the band is 92vh, so
        0.8 x 92vh is the width at which it fits edge to edge. The `min(..., 50%)`
        is the headline's protection — on a tall window 73.6vh would grow past
        half the page and start eating the words. Capped, the crop reappears but
        only on windows over about 1000px tall, and only at the sides.

        `overflow-hidden` sits on the panel rather than on the ground, so the
        KenBurns loop drifts the photograph inside a fixed frame instead of
        drifting the frame's own left edge across the page.
      */}
      <div className="absolute inset-0 overflow-hidden lg:right-0 lg:left-auto lg:w-[min(73.6vh,50%)]">
        <KenBurns className="h-full w-full">
          <PhotoGround
            alt={landingImages.hero.alt}
            category={landingImages.hero.category}
            className="h-full w-full rounded-none"
            fallbackClassName="p-10"
            sizes="(min-width: 1024px) 50vw, 100vw"
            src={landingImages.hero.src ?? undefined}
          />
        </KenBurns>
      </div>

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,var(--void)_0%,var(--void)_34%,color-mix(in_srgb,var(--void)_72%,transparent)_52%,transparent_78%)]"
      />

      <div className="relative mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        {/*
          The plan budgets "one accent in the hero" and it was never drawn.
          A short lacquer rule above the headline is an accent, not a border —
          it outlines nothing and encloses nothing.
        */}
        <span
          aria-hidden
          className="block h-0.5 w-10 rounded-full bg-lacquer"
        />

        <h1 className="t-display-xl mt-7 max-w-[13ch] text-[clamp(40px,5.4vw,72px)] text-bone leading-[0.98]">
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
