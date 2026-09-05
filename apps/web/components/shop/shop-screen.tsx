import type { CategorySlug } from "@workspace/db/taxonomy";
import { ShopClient } from "@/components/shop/shop-client";
import { getCatalog, searchIdle } from "@/lib/data";
import { landingImages } from "@/lib/landing-images";
import { parseShopParams } from "@/lib/shop-params";

/**
 * The shelf, queried on the server.
 *
 * The filters live in the query string and are read here rather than through
 * `useSearchParams` in the client. That is the framework's own advice, and it
 * matters for a real reason: a client component that reads URL data suspends
 * during prerendering, and a boundary that never resolves leaves the server's
 * markup on screen with nothing attached to it — the page looks rendered and
 * is completely dead. Reading the params here means the shelf arrives already
 * filtered, and the client half only has to handle interaction.
 *
 * The Suspense boundary above is deliberately *not* keyed by the query. Keying
 * it would show the skeleton on every filter change, which sounds right until
 * you notice it also throws away the open filter sheet mid-use.
 */

interface ShopScreenProps {
  category?: CategorySlug;
  name: string;
  pathname: string;
  query: string;
}

async function ShopScreen({
  category,
  name,
  pathname,
  query,
}: ShopScreenProps) {
  const params = parseShopParams(new URLSearchParams(query), category);

  /* The tiles are only drawn on the unfiltered shop, so the counts behind them
     are only fetched there. `searchIdle` already assembles exactly this — a
     count per category, zero-count ones dropped — for the search overlay. */
  const [page, idle] = await Promise.all([
    getCatalog(params),
    category ? Promise.resolve(null) : searchIdle(),
  ]);

  /* A category page opens on that category; the unfiltered shop opens on the
     generic one. Resolved here because ShopClient is a client component and
     the lookup reads the filesystem. Either may be absent, and then the band
     falls back to the line renders it has always drawn. */
  /* Tile art first — six categories have a 4:3 shot, which drops into a 4:3
     box losing nothing. The other five only have a 3:1 banner, and a centre
     crop of one keeps the subject and loses the empty sweep either side. Both
     beat a line drawing here, where eleven identical outlines would be the
     whole section. */
  const tiles = (idle?.categories ?? []).map((entry) => ({
    ...entry,
    src:
      landingImages.component[entry.slug]?.src ??
      landingImages.categoryHero[entry.slug]?.src ??
      undefined,
  }));

  const banner = category
    ? landingImages.categoryHero[category]
    : landingImages.pageHero.components;

  return (
    <ShopClient
      category={category}
      categoryTiles={tiles}
      heroSrc={banner?.src ?? undefined}
      name={name}
      page={page}
      params={params}
      pathname={pathname}
      query={query}
    />
  );
}

export { ShopScreen };
