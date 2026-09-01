import { PackageSearchIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { ProductCard } from "./product-card";

/** The shelf. */
export function ProductGrid({
  currency,
  emptyDescription,
  products,
  slug,
}: {
  currency?: string;
  emptyDescription?: string;
  products: CatalogProduct[];
  slug: string;
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        description={
          emptyDescription ??
          "Nothing matched those filters. Try widening the price range."
        }
        icon={PackageSearchIcon}
        title="No parts here"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          currency={currency}
          key={product.id}
          product={product}
          slug={slug}
        />
      ))}
    </div>
  );
}
