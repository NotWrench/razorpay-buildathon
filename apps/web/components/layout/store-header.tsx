import type { Merchant } from "@workspace/db";
import Link from "next/link";
import { SearchField } from "@/components/product/search-field";
import { dashboardRoutes, shellRoutes, storeRoutes } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { CartButton } from "./cart-button";
import { StoreNav } from "./store-nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * The storefront's top bar.
 *
 * A server component so the cart count comes from the same render as the page
 * under it — a badge fetched separately is a badge that disagrees with the
 * cart it links to.
 */
export function StoreHeader({
  cartCount,
  email,
  merchant,
}: {
  cartCount: number;
  email: string | null;
  merchant: Merchant;
}) {
  const routes = storeRoutes(merchant.storeSlug);

  return (
    <header className="sticky top-0 z-30 border-border border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          className="font-heading font-semibold text-base"
          href={routes.home}
        >
          {merchant.businessName}
        </Link>

        <StoreNav
          links={[
            { exact: true, href: routes.home, label: "Home" },
            { href: routes.products, label: "Shop" },
            { href: shellRoutes.build, label: "PC Builder" },
            { href: routes.orders, label: "Orders" },
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <SearchField
            className="hidden w-56 md:block"
            slug={merchant.storeSlug}
          />
          <CartButton count={cartCount} slug={merchant.storeSlug} />
          <ThemeToggle />
          <AccountMenu
            email={email}
            links={[
              { href: routes.orders, label: "My orders" },
              { href: dashboardRoutes.overview, label: "Merchant dashboard" },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
