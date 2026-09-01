import { AssistantDock } from "@/components/assistant/assistant-dock";
import { StoreHero } from "@/components/layout/store-hero";
import { CategoryRail } from "@/components/product/category-rail";
import { listCategories, listFeaturedByCategory } from "@/lib/queries/catalog";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * The shop front.
 *
 * Rails per category rather than one undifferentiated grid: a PC store's
 * catalog is a taxonomy, and a shopper arrives knowing which slot they are
 * filling far more often than they arrive knowing a product name.
 */
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);

  const categories = await listCategories(merchant.id);

  const stocked = categories.filter((category) => category.productCount > 0);

  const rails = await listFeaturedByCategory(
    merchant.id,
    stocked.map((category) => category.slug),
    4
  );

  const productCount = stocked.reduce(
    (sum, category) => sum + category.productCount,
    0
  );

  return (
    <>
      <StoreHero
        categoryCount={stocked.length}
        merchant={merchant}
        productCount={productCount}
      />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {rails.map((rail) => (
          <CategoryRail
            category={rail.category}
            currency={merchant.currency}
            key={rail.category}
            products={rail.products}
            slug={slug}
          />
        ))}
      </main>

      <AssistantDock
        context={{ page: "home" }}
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
