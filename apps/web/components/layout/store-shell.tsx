import type { ReactNode } from "react";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchProvider } from "@/components/search/search-context";
import { SearchOverlay } from "@/components/search/search-overlay";

interface StoreShellProps {
  /** Cart count for the header badge. Mocked until the cart is wired. */
  cartCount?: number;
  children: ReactNode;
  /** The 2px lacquer bar. Off by default; long pages opt in. */
  scrollProgress?: boolean;
}

/**
 * Everything every store page sits inside.
 *
 * The shell is presentational: it takes flags, not context. A page that wants
 * the progress bar can also mount <ScrollProgress /> itself — it is fixed, so
 * where it mounts makes no difference.
 */
function StoreShell({
  children,
  cartCount = 0,
  scrollProgress = false,
}: StoreShellProps) {
  return (
    <SearchProvider>
      <div className="flex min-h-dvh flex-col bg-void">
        {scrollProgress ? <ScrollProgress /> : null}
        <SiteHeader cartCount={cartCount} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
      <SearchOverlay />
    </SearchProvider>
  );
}

export { StoreShell };
