"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { UseCaseMenu } from "@/components/layout/use-case-menu";
import { useSearch } from "@/components/search/search-context";
import { shellRoutes } from "@/lib/routes";

/**
 * The header, driven by one number.
 *
 * `--hp` runs 0 → 1 over the first 120px of scroll, and height, wordmark
 * scale, background alpha, blur and the hairline all read off it. A threshold
 * class would make the header snap at one scroll position; interpolating means
 * it is never caught mid-jump.
 */

const SHRINK_OVER = 120;

/**
 * Routes that open on a full-bleed band. On these the header starts
 * transparent and fades its ground in with `--hp`; everywhere else it carries
 * the ground from the first pixel. Keeping the list here means a page cannot
 * forget to declare itself, and the header stays the only thing that knows.
 */
const HERO_ROUTES = new Set(["/"]);

const NAV = [
  { href: shellRoutes.prebuilts, label: "Prebuilts" },
  { href: shellRoutes.components, label: "Components" },
] as const;

interface SiteHeaderProps {
  cartCount?: number;
}

function useHeaderProgress() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node) {
      return;
    }

    let frame = 0;

    const write = () => {
      frame = 0;
      const progress = Math.min(window.scrollY / SHRINK_OVER, 1);

      node.style.setProperty("--hp", progress.toFixed(4));
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(write);
      }
    };

    write();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return ref;
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={cn(
        "text-[15px] transition-colors duration-[180ms]",
        active ? "text-bone" : "text-smoke hover:text-bone"
      )}
      href={href as never}
    >
      {label}
    </Link>
  );
}

function SiteHeader({ cartCount = 0 }: SiteHeaderProps) {
  const ref = useHeaderProgress();
  const overHero = HERO_ROUTES.has(usePathname());
  const { openSearch } = useSearch();

  return (
    <header
      className="sticky top-0 z-40 w-full"
      ref={ref}
      style={
        {
          "--hp": 0,
          /*
           * No backdrop-filter here. This element is sticky and repaints on
           * every frame of every scroll, which is the one place a blur is
           * genuinely expensive; the ground is raised to near-opaque instead.
           * The two surfaces that do blur are the search overlay and the dock.
           */
          backgroundColor: overHero
            ? "rgb(6 6 6 / calc(0.97 * var(--hp)))"
            : "rgb(6 6 6 / 0.97)",
          height: "calc(88px - 24px * var(--hp))",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-10 px-5 sm:px-8 lg:px-10 2xl:px-16">
        <Link
          className="flex origin-left items-baseline gap-1"
          href={shellRoutes.home}
          style={{ transform: "scale(calc(1 - 0.08 * var(--hp)))" }}
        >
          <span className="font-bold font-display text-[21px] text-bone tracking-[-0.02em]">
            NEXUS
          </span>
          <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <NavLink href={item.href} key={item.label} label={item.label} />
          ))}
          <UseCaseMenu />
          <NavLink href={shellRoutes.assistant} label="Assistant" />
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <button
            className="flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-smoke transition-colors duration-[180ms] hover:border-smoke hover:text-bone"
            onClick={openSearch}
            type="button"
          >
            <Search aria-hidden className="size-4" />
            <span className="sr-only">Search</span>
            <span className="hidden font-mono text-[11px] text-smoke tabular-nums sm:inline">
              ⌘K
            </span>
          </button>

          <Link
            aria-label={`Cart, ${cartCount} items`}
            className="relative flex size-9 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone"
            href={shellRoutes.cart}
          >
            <ShoppingBag aria-hidden className="size-[18px]" />
            {cartCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-riser font-mono text-[10px] text-bone tabular-nums">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <Link
            aria-label="Account"
            className="flex size-7 items-center justify-center rounded-full bg-riser"
            href={shellRoutes.account}
          >
            <Label className="text-[10px] text-bone">S</Label>
          </Link>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-hairline"
        style={{ opacity: "var(--hp)" }}
      />
    </header>
  );
}

export { SiteHeader };
