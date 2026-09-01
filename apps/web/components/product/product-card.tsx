import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { Money } from "@/components/common/money";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { storeRoutes } from "@/lib/routes";
import { headlineSpecs } from "@/lib/specs";
import { AddToCartButton } from "./add-to-cart-button";
import { StockBadge } from "./stock-badge";

/**
 * One product on the shelf.
 *
 * The headline specs come from the same columns the compatibility engine
 * reads, so what the card claims and what the builder later checks cannot
 * drift apart.
 */
export function ProductCard({
  className,
  currency,
  product,
  slug,
}: {
  className?: string;
  currency?: string;
  product: CatalogProduct;
  slug: string;
}) {
  const specs = headlineSpecs(product.category, product.specs);
  const href = storeRoutes(slug).product(product.id);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-md border border-border bg-card p-3 transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {product.brand ? (
            <p className="text-muted-foreground text-xs">{product.brand}</p>
          ) : null}
          <h3 className="font-medium text-sm leading-snug">
            <Link className="hover:underline" href={href}>
              {product.name}
            </Link>
          </h3>
        </div>
        {product.category ? (
          <Badge className="shrink-0 uppercase" variant="secondary">
            {product.category}
          </Badge>
        ) : null}
      </div>

      {specs.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-xs">
          {specs.map((spec) => (
            <li className="rounded-sm bg-muted px-1.5 py-0.5" key={spec}>
              {spec}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex items-end justify-between gap-2 pt-1">
        <div>
          <Money currency={currency} paise={product.price} />
          <StockBadge className="mt-0.5 block" stock={product.stock} />
        </div>

        <AddToCartButton
          disabled={product.stock <= 0}
          label="Add"
          productId={product.id}
          size="xs"
          slug={slug}
          variant="outline"
        />
      </div>
    </article>
  );
}
