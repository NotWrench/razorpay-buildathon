import { PageHeader } from "@/components/common/page-header";
import { ProductTable } from "@/components/dashboard/product-table";
import { CatalogPagination } from "@/components/product/catalog-pagination";
import { CategoryFilter } from "@/components/product/category-filter";
import { parseCatalogParams } from "@/lib/catalog-params";
import { listCatalog, listCategories } from "@/lib/queries/catalog";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * The catalog, listed.
 *
 * The same query the storefront shelf uses, filtered the same way — the
 * merchant should be looking at the rows their customers see, not at a
 * parallel report that can disagree with them.
 */
export default async function DashboardProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  const filters = parseCatalogParams(await searchParams, PAGE_SIZE);

  const [categories, page] = await Promise.all([
    listCategories(merchant.id),
    listCatalog(merchant.id, filters),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        description={`${page.total} active listing(s). A product without published specifications cannot be compatibility-checked.`}
        title="Products"
      />

      <CategoryFilter categories={categories} />

      <ProductTable products={page.products} slug={merchant.storeSlug} />

      <CatalogPagination
        page={filters.page}
        pageSize={PAGE_SIZE}
        total={page.total}
      />
    </div>
  );
}
