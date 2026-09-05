"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { managerRoutes } from "@/lib/routes";

/**
 * The manager's eight places, as text.
 *
 * No icons, no fills, no store switcher. This side of the product is the same
 * company's quieter room — an operator is here to read numbers and approve
 * things, and a rail of coloured buttons would be the loudest thing on a page
 * whose job is to be calm.
 *
 * Below `lg` the same eight items become a bar across the top rather than
 * disappearing. An operator on a phone still has to be able to reach Orders.
 */

const ITEMS: { href: Route; label: string }[] = [
  { href: managerRoutes.assistant, label: "Assistant" },
  { href: managerRoutes.products, label: "Products" },
  { href: managerRoutes.orders, label: "Orders" },
  { href: managerRoutes.restock, label: "Restock" },
  { href: managerRoutes.campaigns, label: "Campaigns" },
  { href: managerRoutes.activity, label: "Activity" },
  { href: managerRoutes.agents, label: "Agents" },
  { href: managerRoutes.account, label: "Account" },
];

function ManagerRail() {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-hairline border-b bg-void px-6 py-4",
        "lg:inset-y-0 lg:right-auto lg:w-[220px] lg:flex-col lg:border-r lg:border-b-0 lg:px-7 lg:py-8",
        "flex flex-col gap-4 lg:gap-0"
      )}
    >
      <div className="flex items-baseline gap-3 lg:block">
        <Link
          className="flex items-baseline gap-1"
          href={managerRoutes.assistant}
        >
          <span className="t-display-sm font-bold text-bone">NEXUS</span>
          <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
        </Link>
        <Label className="lg:mt-1.5 lg:block">Manager</Label>
      </div>

      <nav aria-label="Manager" className="lg:mt-10">
        <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0">
          {ITEMS.map((item) => {
            const current = pathname === item.href;

            return (
              <li key={item.label}>
                <Link
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "t-body flex items-center gap-3 whitespace-nowrap rounded-full py-2 transition-colors duration-micro",
                    current ? "text-bone" : "text-smoke hover:text-bone"
                  )}
                  href={item.href}
                >
                  {/* Same mark the storefront nav uses, for the same reason:
                      red says where you are, bone says everything else. */}
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-[2px] w-4 rounded-full transition-colors duration-micro lg:block",
                      current ? "bg-lacquer" : "bg-transparent"
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export { ManagerRail };
