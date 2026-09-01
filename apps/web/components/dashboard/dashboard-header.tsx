import type { Merchant } from "@workspace/db";
import { Button } from "@workspace/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/layout/account-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { formatPaise } from "@/lib/format";
import { storeRoutes } from "@/lib/routes";

/**
 * The dashboard's top bar.
 *
 * The gateway line is deliberately visible on every page: whether the store is
 * charging through its own Razorpay account or the platform's is the kind of
 * fact that should never be a surprise at settlement time.
 */
export function DashboardHeader({
  email,
  merchant,
  revenuePaise,
  windowDays,
}: {
  email: string | null;
  merchant: Merchant;
  revenuePaise: number;
  windowDays: number;
}) {
  const routes = storeRoutes(merchant.storeSlug);

  return (
    <header className="border-border border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div>
          <h1 className="font-heading font-semibold text-base">
            {merchant.businessName}
          </h1>
          <p className="text-muted-foreground text-xs">
            {formatPaise(revenuePaise, merchant.currency)} in {windowDays} days
            ·{" "}
            {merchant.razorpayKeyId
              ? "Razorpay connected"
              : "platform gateway keys"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            render={<Link href={routes.home} />}
            size="sm"
            variant="outline"
          >
            <ExternalLinkIcon />
            Storefront
          </Button>
          <ThemeToggle />
          <AccountMenu
            email={email}
            links={[{ href: routes.home, label: "View storefront" }]}
          />
        </div>
      </div>
    </header>
  );
}
