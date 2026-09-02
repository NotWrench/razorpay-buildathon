"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { route, shellRoutes } from "@/lib/routes";

/**
 * The account's five sections, as text.
 *
 * No icons and no fills: this is a list of places, not a set of actions, and a
 * rail of filled pills would put five buttons on a page whose one real button
 * is somewhere else. The active item is bone with a short marker, which is the
 * least decoration that still answers "where am I".
 *
 * Three of the five are blocks on the profile rather than routes of their own.
 * They are anchors, so the rail is honest about it — pressing Orders takes you
 * to the orders, wherever they happen to live.
 */

interface RailItem {
  href: Route;
  label: string;
  /** True when the item is a page, not a place on this page. */
  page: boolean;
}

const ITEMS: RailItem[] = [
  { href: shellRoutes.account, label: "Profile", page: true },
  { href: route("/account#orders"), label: "Orders", page: false },
  { href: route("/account#builds"), label: "Builds", page: false },
  { href: route("/account#addresses"), label: "Addresses", page: false },
  { href: shellRoutes.accountSettings, label: "Settings", page: true },
];

function AccountRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="w-[220px] shrink-0">
      <ul className="grid gap-1">
        {ITEMS.map((item) => {
          /* Only a page can be the page you are on. An anchor never lights. */
          const current = item.page && pathname === item.href;

          return (
            <li key={item.label}>
              <Link
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full py-2 text-[15px] transition-colors duration-[180ms]",
                  current ? "text-bone" : "text-smoke hover:text-bone"
                )}
                href={item.href}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-[2px] w-4 rounded-full transition-colors duration-[180ms]",
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
  );
}

export { AccountRail };
