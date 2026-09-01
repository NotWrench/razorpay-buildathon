import { Badge } from "@workspace/ui/components/badge";
import { notFound } from "next/navigation";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { AddToBuildButton } from "@/components/build/add-to-build-button";
import { Money } from "@/components/common/money";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { ProductGrid } from "@/components/product/product-grid";
import { SpecTable } from "@/components/product/spec-table";
import { StockBadge } from "@/components/product/stock-badge";
import { getLatestBuild } from "@/lib/queries/builds";
import {
  categoryLabel,
  getCatalogProduct,
  listAlternatives,
} from "@/lib/queries/catalog";
import { attributeEntries, specEntries } from "@/lib/specs";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * One part.
 *
 * Two purchase paths, because a PC store has two kinds of shopper: the spare
 * that goes straight to the cart, and the component that belongs in a build
 * and has to be checked against the rest of it first.
 *
 * The assistant opens with this product as its §7 context, so "will this fit?"
 * needs no restating.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const merchant = await requireStore(slug);

  const product = await getCatalogProduct(merchant.id, id);

  if (!product?.isActive) {
    notFound();
  }

  const buyer = await currentBuyer();

  const [alternatives, build] = await Promise.all([
    listAlternatives(merchant.id, product),
    getLatestBuild({
      buyerIdentifier: buyer.identifier,
      merchantId: merchant.id,
    }),
  ]);

  const specs = specEntries(product.specs);
  const attributes = attributeEntries(product.attributes);
  const buildable = Boolean(product.category);

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                {product.category ? (
                  <Badge variant="secondary">
                    {categoryLabel(product.category)}
                  </Badge>
                ) : null}
                {product.brand ? (
                  <span className="text-muted-foreground text-sm">
                    {product.brand}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-2 font-heading font-semibold text-2xl tracking-tight">
                {product.name}
              </h1>

              {product.description ? (
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
            </header>

            <section className="space-y-3">
              <h2 className="font-heading font-semibold text-lg">
                Specifications
              </h2>
              <SpecTable
                caption="Read by the compatibility engine"
                entries={specs}
              />
            </section>

            {attributes.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-heading font-semibold text-lg">Details</h2>
                <SpecTable entries={attributes} />
              </section>
            ) : null}

            {alternatives.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-heading font-semibold text-lg">
                  Other{" "}
                  {product.category ? categoryLabel(product.category) : "parts"}
                </h2>
                <ProductGrid
                  currency={merchant.currency}
                  products={alternatives}
                  slug={slug}
                />
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-md border border-border p-4">
              <Money
                currency={merchant.currency}
                paise={product.price}
                size="lg"
              />
              <StockBadge className="mt-1 block" stock={product.stock} />

              <div className="mt-4 flex flex-col gap-2">
                <AddToCartButton
                  disabled={product.stock <= 0}
                  productId={product.id}
                  slug={slug}
                />
                {buildable ? (
                  <AddToBuildButton
                    buildId={build?.id ?? null}
                    productId={product.id}
                    slug={slug}
                  />
                ) : null}
              </div>

              {product.sku ? (
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                  SKU {product.sku}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </main>

      <AssistantDock
        context={{
          buildId: build?.id,
          page: "product",
          productId: product.id,
        }}
        initialMode="about"
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
