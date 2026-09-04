import { Label } from "@workspace/ui/components/label";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PillLink } from "@/components/common/pill-link";
import { AssistantDock } from "@/components/dock/assistant-dock";
import { BuyControls } from "@/components/product/buy-controls";
import { CompatibilityStrip } from "@/components/product/compatibility-strip";
import { ComponentCard } from "@/components/product/component-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductTabs } from "@/components/product/product-tabs";
import { getProduct, openBuild } from "@/lib/data";
import { storeSlug } from "@/lib/data/store";
import { route } from "@/lib/routes";

/**
 * One part.
 *
 * Marketing before specification, the way ORIGIN's pages run: what it is and
 * whether it fits your build come first, and the exhaustive tables sit under
 * tabs below. The compatibility strip is the only coloured thing in the buying
 * column, because it is the only thing on the page that can stop the purchase.
 */

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  return {
    description: product?.description,
    title: product ? `${product.brand} ${product.name}` : "Product",
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const [product, build, slug] = await Promise.all([
    getProduct(id),
    openBuild(),
    storeSlug(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 sm:px-8 lg:px-10 2xl:px-16">
      <div className="grid gap-14 lg:grid-cols-[55%_1fr]">
        <ProductGallery
          alt={product.name}
          category={product.category}
          views={product.images}
        />

        <div>
          <Label>{product.brand}</Label>
          <h1 className="t-display-md mt-3 text-bone">
            {product.name}
          </h1>

          <PriceBlock
            className="mt-7"
            compareAtPaise={product.compareAtPaise}
            pricePaise={product.pricePaise}
            size="lg"
          />

          {product.colourways?.length ? (
            <div className="mt-7 flex items-center gap-2.5">
              <Label className="mr-2">Finish</Label>
              {product.colourways.map((colourway) => (
                <span
                  className="size-[15px] rounded-full border border-hairline"
                  key={colourway.name}
                  style={{ backgroundColor: colourway.hex }}
                  title={colourway.name}
                />
              ))}
            </div>
          ) : null}

          <BuyControls
            buildId={build?.id}
            buildName={build?.name}
            onHand={product.onHand}
            productId={product.id}
            slug={slug}
            stock={product.stock}
          />

          <div className="mt-8">
            <CompatibilityStrip report={product.compatibility} />
          </div>

          <p className="t-body mt-8 max-w-[60ch] text-smoke">
            {product.description}
          </p>

          <p className="t-num-xs mt-8 text-smoke">
            {product.sku}
          </p>
        </div>
      </div>

      <div className="mt-24">
        <ProductTabs product={product} />
      </div>

      <p className="t-body mt-20 flex items-center gap-2 text-smoke">
        <Sparkles aria-hidden className="size-4" />
        <PillLink
          className="text-smoke hover:text-bone"
          href={route(`/assistant?product=${product.id}`)}
          variant="text"
        >
          Ask the assistant about this part →
        </PillLink>
      </p>

      <AssistantDock
        context={{ page: "product", productId: product.id }}
        contextLabel={product.name}
        hasNews={product.compatibility?.overall === "incompatible"}
      />

      {product.alternatives.length > 0 ? (
        <section className="mt-24">
          <Label>Alternatives</Label>
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            {product.alternatives.map((alternative) => (
              <ComponentCard key={alternative.id} product={alternative} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
