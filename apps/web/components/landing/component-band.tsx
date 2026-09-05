import type { CategorySlug } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import Link from "next/link";
import { PhotoGround } from "@/components/common/photo-ground";
import { PillLink } from "@/components/common/pill-link";
import { landingImages } from "@/lib/landing-images";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 5 — full-bleed on carbon, six tiles.
 *
 * It used to be a contained grid directly beneath the lineup, which is also a
 * contained grid — the one thing §4.5 rules out, and the reason the middle of
 * the page read as one long undifferentiated column.
 *
 * The category list appears here and nowhere else on the page. An earlier
 * version put it beneath a three-column section and it rendered once per
 * column; one grid with one source of counts makes that impossible.
 */
interface CategoryTile {
  count: number;
  name: string;
  slug: CategorySlug;
}

function ComponentBand({
  tiles,
  totalCategories,
}: {
  tiles: CategoryTile[];
  totalCategories: number;
}) {
  return (
    <section className="w-full bg-carbon py-24 lg:py-28">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
        <Label>Shop by component</Label>
        <h2 className="t-display-md mt-4 max-w-[22ch] text-bone">
          Or start from the part you already know you want.
        </h2>

        <Stagger className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <Link
              className="group block"
              href={shellRoutes.shopCategory(tile.slug)}
              key={tile.slug}
            >
              <PhotoGround
                alt={tile.name}
                category={tile.slug}
                className="aspect-[4/3] transition-transform duration-micro group-hover:-translate-y-0.5"
                fallbackClassName="p-5"
                imageClassName="transition-transform duration-standard group-hover:scale-[1.03]"
                sizes="(min-width: 1024px) 200px, (min-width: 768px) 30vw, 45vw"
                src={landingImages.component[tile.slug]?.src ?? undefined}
              />
              <p className="t-body mt-3 text-bone">{tile.name}</p>
              <p className="t-num-xs mt-1 text-smoke">{tile.count}</p>
            </Link>
          ))}
        </Stagger>

        <div className="mt-10">
          <PillLink href={shellRoutes.components} variant="text">
            All {totalCategories} categories →
          </PillLink>
        </div>
      </div>
    </section>
  );
}

export type { CategoryTile };
export { ComponentBand };
