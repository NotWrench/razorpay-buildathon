import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import Link from "next/link";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import { shellRoutes } from "@/lib/routes";

/**
 * Band 5 — contained, six tiles.
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
    <section className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10 2xl:px-16">
      <Label>Shop by component</Label>
      <h2 className="mt-4 max-w-[22ch] font-display font-semibold text-[28px] text-bone tracking-[-0.02em]">
        Or start from the part you already know you want.
      </h2>

      <Stagger className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            className="group block"
            href={shellRoutes.shopCategory(tile.slug)}
            key={tile.slug}
          >
            <ImageGround className="aspect-[4/3] p-5">
              <ProductRender
                alt={tile.name}
                category={tile.slug}
                className="transition-transform duration-[420ms] group-hover:scale-[1.03]"
              />
            </ImageGround>
            <p className="mt-3 text-[15px] text-smoke transition-colors duration-[180ms] group-hover:text-bone">
              {tile.name}
            </p>
            <p className="mt-1 font-mono text-[13px] text-smoke tabular-nums">
              {tile.count}
            </p>
          </Link>
        ))}
      </Stagger>

      <div className="mt-10">
        <PillLink href={shellRoutes.components} variant="text">
          All {totalCategories} categories →
        </PillLink>
      </div>
    </section>
  );
}

export type { CategoryTile };
export { ComponentBand };
