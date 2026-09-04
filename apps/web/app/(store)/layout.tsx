import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/store-shell";
import { countCart } from "@/lib/data";
import { currentUser } from "@/lib/session";

/**
 * The storefront. Every page in this group inherits the header, the footer and
 * the route transition.
 *
 * The badge count is the buyer's own open cart — read here rather than in the
 * header so a guest whose identity is minted per request does not have a cart
 * row created for them just by loading a page. See `lib/data/cart.ts`.
 */
export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [cartCount, user] = await Promise.all([countCart(), currentUser()]);

  return (
    <StoreShell cartCount={cartCount} user={user}>
      {children}
    </StoreShell>
  );
}
