import { AssistantDock } from "@/components/assistant/assistant-dock";
import { PageHeader } from "@/components/common/page-header";
import { CatalogPagination } from "@/components/product/catalog-pagination";
import { CategoryFilter } from "@/components/product/category-filter";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductToolbar } from "@/components/product/product-toolbar";
import { SearchField } from "@/components/product/search-field";
import { parseCatalogParams } from "@/lib/catalog-params";
import { listCatalog, listCategories } from "@/lib/queries/catalog";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

/**
 * The shelf.
 *
 * Filters live in the query string, so the server does the filtering and a
 * filtered view is a link somebody can send. The search here is lexical on
 * purpose — the semantic path is the assistant's, and a box that quietly
 * reinterprets what was typed is a box nobody can predict.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);

  const filters = parseCatalogParams(await searchParams, PAGE_SIZE);

  const [categories, page] = await Promise.all([
    listCategories(merchant.id),
    listCatalog(merchant.id, filters),
  ]);

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <PageHeader
          description="Every part carries the specifications the compatibility engine reads."
          title={filters.query ? `Results for “${filters.query}”` : "All parts"}
        />

        <div className="space-y-4">
          <SearchField
            className="md:hidden"
            defaultValue={filters.query}
            slug={slug}
          />

          <CategoryFilter categories={categories} />

          <ProductToolbar total={page.total} />

          <ProductGrid
            currency={merchant.currency}
            products={page.products}
            slug={slug}
          />

          <CatalogPagination
            page={filters.page}
            pageSize={PAGE_SIZE}
            total={page.total}
          />
        </div>
      </main>

      <AssistantDock
        context={{ page: "search", searchQuery: filters.query }}
        initialMode="recommend"
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
