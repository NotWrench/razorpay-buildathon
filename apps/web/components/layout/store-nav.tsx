"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The storefront's primary links, with the current section marked. */
export function StoreNav({
  links,
}: {
  links: { exact?: boolean; href: Route; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium text-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
