import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import Link from "next/link";
import { ProductRender } from "@/components/common/product-render";
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
      <h2 className="mt-4 max-w-[20ch] font-display font-semibold text-[28px] text-bone tracking-[-0.02em]">
        Start from what you are going to do with it.
      </h2>

      <Stagger className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            className="group block"
            href={shellRoutes.byUse(tile.value)}
            key={tile.value}
          >
            <ImageGround className="relative aspect-[4/3] rounded-[20px] p-8">
              <ProductRender
                alt={tile.label}
                category={tile.category}
                className="transition-transform duration-[420ms] group-hover:scale-[1.03]"
              />
              <span className="absolute inset-x-6 bottom-5 font-display font-medium text-[17px] text-smoke uppercase tracking-[0.05em] transition-colors duration-[180ms] group-hover:text-bone">
                {tile.label}
              </span>
            </ImageGround>
            {tile.machines > 0 ? (
              <p className="mt-3 font-mono text-[13px] text-smoke tabular-nums">
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
