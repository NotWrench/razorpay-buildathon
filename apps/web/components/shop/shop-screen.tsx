import type { CategorySlug } from "@workspace/db/taxonomy";
import { ShopClient } from "@/components/shop/shop-client";
import { getCatalog } from "@/lib/data";
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
  const page = await getCatalog(params);

  return (
    <ShopClient
      category={category}
      name={name}
      page={page}
      params={params}
      pathname={pathname}
      query={query}
    />
  );
}

export { ShopScreen };
