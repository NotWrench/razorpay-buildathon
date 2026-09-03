"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { managerRoutes } from "@/lib/routes";

/**
 * The manager's five places, as text.
 *
 * No icons, no fills, no store switcher. This side of the product is the same
 * company's quieter room — an operator is here to read numbers and approve
 * things, and a rail of coloured buttons would be the loudest thing on a page
 * whose job is to be calm.
 *
 * Below `lg` the same five items become a bar across the top rather than
 * disappearing. An operator on a phone still has to be able to reach Orders.
 */

const ITEMS: { href: Route; label: string }[] = [
  { href: managerRoutes.assistant, label: "Assistant" },
  { href: managerRoutes.products, label: "Products" },
  { href: managerRoutes.orders, label: "Orders" },
  { href: managerRoutes.restock, label: "Restock" },
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
          <span className="font-bold font-display text-[21px] text-bone tracking-[-0.02em]">
            NEXUS
          </span>
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
                    "flex items-center gap-3 whitespace-nowrap rounded-full py-2 text-[15px] transition-colors duration-[180ms]",
                    current ? "text-bone" : "text-smoke hover:text-bone"
                  )}
                  href={item.href}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-[2px] w-4 rounded-full transition-colors duration-[180ms] lg:block",
                      current ? "bg-bone" : "bg-transparent"
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
