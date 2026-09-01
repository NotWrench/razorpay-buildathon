import type { ReactNode } from "react";
import { StoreHeader } from "@/components/layout/store-header";
import { countCartItems } from "@/lib/queries/cart";
import { currentUser } from "@/lib/session";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

/**
 * The storefront shell.
 *
 * The store, the buyer and the cart count are resolved once here and the pages
 * underneath re-resolve them from the same request-scoped cache. The assistant
 * is not mounted here — each page mounts it with its own §7 context, because a
 * dock that knew only the layout would know only the store.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();
  const user = await currentUser();

  const cartCount = await countCartItems({
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
  });

  return (
    <div className="min-h-svh bg-background">
      <StoreHeader
        cartCount={cartCount}
        email={user?.email ?? null}
        merchant={merchant}
      />
      {children}
    </div>
  );
}
