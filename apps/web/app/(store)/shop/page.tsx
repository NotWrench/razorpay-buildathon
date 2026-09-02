import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopFallback } from "@/components/shop/shop-fallback";
import { ShopScreen } from "@/components/shop/shop-screen";
import { toQueryString } from "@/lib/shop-params";

/**
 * Every component, unfiltered. The category pages are this page with one slug
 * applied, so both render the same screen.
 */

export const metadata: Metadata = {
  description: "Every part in the catalogue, filterable against your build.",
  title: "Components",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = toQueryString(await searchParams);

  return (
    <Suspense fallback={<ShopFallback name="Components" />}>
      <ShopScreen name="Components" pathname="/shop" query={query} />
    </Suspense>
  );
}
