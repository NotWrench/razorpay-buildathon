import type { CategorySlug } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import Link from "next/link";
import { PhotoGround } from "@/components/common/photo-ground";
import { landingImages } from "@/lib/landing-images";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 2 — contained, four tiles.
 *
 * What a visitor with no vocabulary clicks. The count is machines that
 * actually carry the use case; a tile with nothing behind it yet shows no
 * count rather than a zero.
 */
interface UseCaseTile {
  category: CategorySlug;
  label: string;
  machines: number;
  value: string;
}

function UseCaseBand({ tiles }: { tiles: UseCaseTile[] }) {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
      <Label>Shop by use</Label>
      <h2 className="t-display-md mt-4 max-w-[20ch] text-bone">
        Start from what you are going to do with it.
      </h2>

      <Stagger className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            className="group block"
            href={shellRoutes.byUse(tile.value)}
            key={tile.value}
          >
            <PhotoGround
              alt={tile.label}
              category={tile.category}
              className="aspect-[4/3] rounded-[20px] transition-transform duration-micro group-hover:-translate-y-0.5"
              fallbackClassName="p-8"
              imageClassName="transition-transform duration-standard group-hover:scale-[1.03]"
              sizes="(min-width: 1024px) 300px, 45vw"
              src={landingImages.useCase[tile.value]?.src ?? undefined}
            >
              {/*
                The name is set over the photograph, so it needs a floor. This
                used to be belt-and-braces: the tile's padding left a strip of
                flat ground under the label and the scrim only had to darken
                it. The photograph now runs to the bottom edge, so the scrim is
                the only thing between white text and a lit studio floor — hence
                the deeper ramp.
              */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--void)_35%,transparent)_55%,color-mix(in_srgb,var(--void)_92%,transparent)_100%)]"
              />
              <span className="t-model absolute inset-x-6 bottom-5 text-base text-bone">
                {tile.label}
              </span>
            </PhotoGround>
            {tile.machines > 0 ? (
              <p className="t-num-xs mt-3 text-smoke">
                {tile.machines} {tile.machines === 1 ? "machine" : "machines"}
              </p>
            ) : null}
          </Link>
        ))}
      </Stagger>
    </section>
  );
}

export type { UseCaseTile };
export { UseCaseBand };
