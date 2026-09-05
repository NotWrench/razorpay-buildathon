"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * The last store page the shopper was on.
 *
 * The assistant lives outside the store shell and needs a Back control that
 * returns somewhere useful. `document.referrer` cannot answer that: it is set
 * when the *document* loads and never changes again, so after any client-side
 * navigation it still names whatever site the tab came from — usually nothing
 * at all. A Back button built on it falls through to the home page every time,
 * which is exactly the bug this exists to fix.
 *
 * So the shell writes down where it has been. One key, overwritten on every
 * store page, read once by the assistant's Back control. `sessionStorage`
 * rather than `localStorage` because this is about one tab's journey, and it
 * should not survive the tab.
 */

const KEY = "alfred:last-store-path";

function rememberStorePath(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* Private browsing, or storage disabled. Back falls back to home. */
  }
}

/** Where the shopper was, or null when this tab has not been anywhere yet. */
export function lastStorePath(): string | null {
  try {
    const stored = sessionStorage.getItem(KEY);

    /* Only ever an in-app path, never a full URL — nothing can redirect off. */
    return stored?.startsWith("/") && !stored.startsWith("//") ? stored : null;
  } catch {
    return null;
  }
}

export function RouteMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    rememberStorePath(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);

  return null;
}
