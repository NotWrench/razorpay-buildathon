"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  BoxesIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptTextIcon,
  SparklesIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardRoutes } from "@/lib/routes";

/** The sections of the merchant dashboard. */

const LINKS: { href: Route; icon: LucideIcon; label: string }[] = [
  {
    href: dashboardRoutes.overview,
    icon: LayoutDashboardIcon,
    label: "Overview",
  },
  { href: dashboardRoutes.assistant, icon: SparklesIcon, label: "Assistant" },
  { href: dashboardRoutes.orders, icon: ReceiptTextIcon, label: "Orders" },
  { href: dashboardRoutes.inventory, icon: BoxesIcon, label: "Inventory" },
  { href: dashboardRoutes.products, icon: PackageIcon, label: "Products" },
  { href: dashboardRoutes.insights, icon: LightbulbIcon, label: "Insights" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((link) => {
        const active =
          link.href === dashboardRoutes.overview
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 font-medium text-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            href={link.href}
            key={link.href}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
