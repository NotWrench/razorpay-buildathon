"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { HeaderAccount } from "@/components/layout/header-account";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UseCaseMenu } from "@/components/layout/use-case-menu";
import { useSearch } from "@/components/search/search-context";
import { shellRoutes } from "@/lib/routes";
import type { CurrentUser } from "@/lib/session";

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
  { href: shellRoutes.build, label: "Build yours" },
] as const;

interface SiteHeaderProps {
  cartCount?: number;
  initialUser?: CurrentUser;
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

/**
 * The active nav item is one of the five reds §4.1 budgets for, and it was
 * being spent on nothing: the only difference between here and not-here was
 * smoke versus bone, which is the same difference as hovering.
 *
 * A two-pixel rule under the label, not a fill. Red as a fill means "this
 * does something"; red as a mark means "this is where you are."
 */
function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={cn(
        "t-body relative py-1 transition-colors duration-micro",
        active ? "text-bone" : "text-smoke hover:text-bone"
      )}
      href={href as never}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-lacquer transition-transform duration-exit",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </Link>
  );
}

function SiteHeader({ cartCount = 0, initialUser }: SiteHeaderProps) {
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
          <span className="t-display-sm font-bold text-bone">NEXUS</span>
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
            className="flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-smoke transition-colors duration-micro hover:border-smoke hover:text-bone"
            onClick={openSearch}
            type="button"
          >
            <Search aria-hidden className="size-4" />
            <span className="sr-only">Search</span>
            <span className="t-num-xs hidden text-smoke sm:inline">⌘K</span>
          </button>

          <Link
            aria-label={`Cart, ${cartCount} items`}
            className="relative flex size-9 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:text-bone"
            href={shellRoutes.cart}
          >
            <ShoppingBag aria-hidden className="size-[18px]" />
            {cartCount > 0 ? (
              <span className="t-num-xs absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-riser text-bone">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <HeaderAccount
            avatarClassName="hidden md:flex"
            className="hidden sm:inline-flex"
            initialUser={initialUser}
          />

          {/* Below md the nav row is hidden, so everything it held moves here. */}
          <MobileNav initialUser={initialUser} />
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
