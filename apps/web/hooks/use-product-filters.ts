"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { route } from "@/lib/routes";

/**
 * Catalog filters, kept in the URL.
 *
 * The shelf is server-rendered, so the filters have to live somewhere the
 * server can read: a query string is shareable, survives a reload, and lets
 * the back button undo a filter — none of which local state gives you.
 */

export type FilterKey =
  | "category"
  | "inStock"
  | "max"
  | "min"
  | "page"
  | "q"
  | "sort";

export function useProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (updates: Partial<Record<FilterKey, string | null>>) => {
      const next = new URLSearchParams(params.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      // Any change to the filters invalidates the page number — page 3 of a
      // different result set is not where the shopper was.
      if (!("page" in updates)) {
        next.delete("page");
      }

      startTransition(() => {
        router.push(route(`${pathname}?${next.toString()}`), { scroll: false });
      });
    },
    [params, pathname, router]
  );

  const get = useCallback((key: FilterKey) => params.get(key), [params]);

  const clear = useCallback(() => {
    startTransition(() => {
      router.push(route(pathname), { scroll: false });
    });
  }, [pathname, router]);

  return { clear, get, params, pending, set };
}
