import { Button } from "@workspace/ui/components/button";
import { ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { IssueList } from "@/components/build/issue-list";
import { CartLineRow } from "@/components/cart/cart-line-row";
import { CheckoutPanel } from "@/components/cart/checkout-panel";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { loadCartView } from "@/lib/queries/cart";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * The basket.
 *
 * Builds in the cart are validated as the cart actually holds them, not as the
 * build row remembers itself — a buyer who removed the case is buying a build
 * without a case whatever the row says. The same check runs again inside
 * checkout, so nothing here is the real gate.
 */
export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();

  const cart = await loadCartView({
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
  });

  const itemCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);

  const blocking = cart.buildValidations.flatMap((entry) =>
    entry.validation.issues.filter((issue) => issue.severity === "blocking")
  );

  const warnings = cart.buildValidations.flatMap((entry) =>
    entry.validation.issues.filter((issue) => issue.severity === "warning")
  );

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader title="Your cart" />

        {cart.lines.length === 0 || !cart.cartId ? (
          <EmptyState
            action={
              <Button render={<Link href={`/store/${slug}/products`} />}>
                Browse parts
              </Button>
            }
            description="Add a part, or build a whole machine and put it in as one group."
            icon={ShoppingCartIcon}
            title="Nothing in the cart"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              {cart.lines.map((line) => (
                <CartLineRow
                  currency={merchant.currency}
                  key={line.id}
                  line={line}
                  slug={slug}
                />
              ))}

              {blocking.length > 0 || warnings.length > 0 ? (
                <section className="mt-6 rounded-md border border-border p-4">
                  <h2 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                    About the build in this cart
                  </h2>
                  <IssueList issues={[...blocking, ...warnings]} />
                </section>
              ) : null}
            </div>

            <aside className="lg:sticky lg:top-20 lg:self-start">
              <CheckoutPanel
                cartId={cart.cartId}
                currency={merchant.currency}
                itemCount={itemCount}
                slug={slug}
                storeName={merchant.businessName}
                subtotalPaise={cart.subtotalPaise}
              />
            </aside>
          </div>
        )}
      </main>

      <AssistantDock
        context={{ cartId: cart.cartId ?? undefined, page: "cart" }}
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
