import { ArrowRightIcon } from "lucide-react";
import { ButtonLink } from "@/components/common/button-link";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { categoryLabel } from "@/lib/queries/catalog";
import { storeRoutes } from "@/lib/routes";
import { ProductCard } from "./product-card";

/** A few parts from one category, with a way into the rest of it. */
export function CategoryRail({
  category,
  currency,
  products,
  slug,
}: {
  category: string;
  currency?: string;
  products: CatalogProduct[];
  slug: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading font-semibold text-lg">
          {categoryLabel(category)}
        </h2>
        <ButtonLink
          href={storeRoutes(slug).productsInCategory(category)}
          size="xs"
          variant="ghost"
        >
          See all
          <ArrowRightIcon />
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            currency={currency}
            key={product.id}
            product={product}
            slug={slug}
          />
        ))}
      </div>
    </section>
  );
}
