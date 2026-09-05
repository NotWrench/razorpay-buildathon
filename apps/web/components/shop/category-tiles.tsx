import type { CategorySlug } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import Link from "next/link";
import { PhotoGround } from "@/components/common/photo-ground";
import { shellRoutes } from "@/lib/routes";

/**
 * The eleven categories, at the top of the unfiltered shop.
 *
 * `/shop` opened on a flat grid of every part in the catalogue, which is the
 * least useful way to begin: nobody wants "all 67 parts", they want a
 * processor. The landing page has had a version of this for six of the eleven
 * from the start — this is that idea where it actually belongs, with the other
 * five included and the per-category art that already exists for all of them.
 *
 * Only on `/shop`. A category page is already the answer to this question.
 *
 * `src` is resolved by `shop-screen` on the server rather than looked up here:
 * this component is reached through `ShopClient`, which is a client component,
 * and the image manifest reads the filesystem. Importing it here fails the
 * build with "the chunking context does not support external modules".
 */

interface CategoryTile {
  count: number;
  label: string;
  slug: CategorySlug;
  /** The tile shot, the banner shot, or nothing — decided on the server. */
  src?: string;
}

function CategoryTiles({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[1280px] px-8 pt-14 lg:px-16">
      <Label>Start with a part</Label>

      <Stagger className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            className="group block"
            href={shellRoutes.shopCategory(tile.slug)}
            key={tile.slug}
          >
            <PhotoGround
              alt={tile.label}
              category={tile.slug}
              className="aspect-[4/3] transition-transform duration-micro group-hover:-translate-y-0.5"
              fallbackClassName="p-6"
              imageClassName="transition-transform duration-standard group-hover:scale-[1.03]"
              sizes="(min-width: 1024px) 280px, (min-width: 768px) 30vw, 45vw"
              src={tile.src}
            />
            <p className="t-body mt-3 text-bone">{tile.label}</p>
            <p className="t-num-xs mt-1 text-smoke">
              {tile.count} {tile.count === 1 ? "part" : "parts"}
            </p>
          </Link>
        ))}
      </Stagger>
    </section>
  );
}

export type { CategoryTile };
export { CategoryTiles };
