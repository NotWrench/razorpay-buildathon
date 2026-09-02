import { CATEGORY_DEFINITIONS, isCategorySlug } from "@workspace/db/taxonomy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopFallback } from "@/components/shop/shop-fallback";
import { ShopScreen } from "@/components/shop/shop-screen";
import { toQueryString } from "@/lib/shop-params";

/**
 * One category. The slugs are fixed by `taxonomy.ts`, so anything else is a
 * 404 rather than an empty shelf.
 */

type Params = Promise<{ category: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { category } = await params;
  const definition = CATEGORY_DEFINITIONS.find(
    (entry) => entry.slug === category
  );

  return { title: definition?.name ?? "Components" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category } = await params;

  if (!isCategorySlug(category)) {
    notFound();
  }

  const definition = CATEGORY_DEFINITIONS.find(
    (entry) => entry.slug === category
  );
  const name = definition?.name ?? "Components";
  const query = toQueryString(await searchParams);

  return (
    <Suspense fallback={<ShopFallback name={name} />}>
      <ShopScreen
        category={category}
        name={name}
        pathname={`/shop/${category}`}
        query={query}
      />
    </Suspense>
  );
}
