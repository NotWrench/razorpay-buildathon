import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Shimmer } from "@workspace/ui/components/motion/shimmer";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import Link from "next/link";
import { ProductRender } from "@/components/common/product-render";
import type { ProductSummary } from "@/lib/mock/types";
import { shellRoutes } from "@/lib/routes";

/**
 * The component card — §6.2, and the most reused thing on the site.
 *
 * Three labelled spec rows rather than one joined string. That is the whole
 * difference between "a part" and "a part I can choose from". No badges, no
 * ratings, no hearts, no stacked buttons, and nothing at all about stock when
 * the stock is plain in-stock.
 *
 * (The v1 storefront's own `product-card.tsx` still sits beside this one and
 * still serves `/store/[slug]`. They are different components for different
 * data shapes; this one takes `ProductSummary`.)
 */

const STOCK = {
  low_stock: { message: "Low stock.", state: "needs_verification" },
  out_of_stock: { message: "Out of stock.", state: "incompatible" },
} as const;

function ComponentCard({ product }: { product: ProductSummary }) {
  const status = product.stock === "in_stock" ? null : STOCK[product.stock];

  return (
    <Link
      className="group flex flex-col rounded-[20px] border border-hairline bg-panel p-5 shadow-card transition-[transform,border-color] duration-[180ms] hover:-translate-y-0.5 hover:border-smoke/40"
      href={shellRoutes.product(product.id)}
    >
      <ImageGround className="aspect-[16/10] p-6">
        <ProductRender
          alt={product.name}
          category={product.category}
          className="transition-transform duration-[420ms] group-hover:scale-[1.03]"
        />
      </ImageGround>

      <Label className="mt-5">{product.brand}</Label>
      <h3 className="mt-2 line-clamp-2 min-h-[44px] text-[15px] text-bone">
        {product.name}
      </h3>

      <SpecList className="mt-4" rows={product.keySpecs} />

      <PriceBlock
        className="mt-4"
        compareAtPaise={product.compareAtPaise}
        pricePaise={product.pricePaise}
        size="sm"
      />

      {status ? (
        <StatusLine
          className="mt-3"
          message={status.message}
          state={status.state}
        />
      ) : null}

      <span className="mt-4 text-[13px] text-smoke opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100 group-focus-visible:opacity-100">
        Configure →
      </span>
    </Link>
  );
}

/**
 * The loading state, built to the card's exact dimensions so the grid does not
 * shift a pixel when the real cards arrive.
 */
function ComponentCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[20px] border border-hairline bg-panel p-5">
      <Shimmer className="aspect-[16/10]" radius="ground" />
      <Shimmer className="mt-5 h-3 w-16" radius="pill" />
      <Shimmer className="mt-3 h-[38px] w-full" radius="pill" />
      <div className="mt-4 border-hairline border-t border-b py-[7px]">
        <Shimmer className="h-4 w-full" radius="pill" />
        <Shimmer className="mt-3 h-4 w-full" radius="pill" />
        <Shimmer className="mt-3 h-4 w-full" radius="pill" />
      </div>
      <Shimmer className="mt-4 h-5 w-28" radius="pill" />
      <div className="mt-4 h-[18px]" />
    </div>
  );
}

export { ComponentCard, ComponentCardSkeleton };
