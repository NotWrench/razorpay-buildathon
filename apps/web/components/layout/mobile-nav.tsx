"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { Menu, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { shellRoutes } from "@/lib/routes";
import type { HeaderAccountUser } from "./header-account";

/**
 * The nav, below md.
 *
 * The header's own `<nav>` is `hidden md:flex`, so on a phone the site had no
 * navigation at all — the wordmark, search and cart, and no way to reach
 * Prebuilts, Components, the builder or the assistant except by typing a URL.
 *
 * A panel rather than a dropdown: the use-case rows carry a second line of
 * copy each, and eight touch targets at 44px need the room. It closes on
 * navigation, which `usePathname` reports without the links having to say so.
 */

const USE_CASES = [
  { label: "Gaming", value: "gaming" },
  { label: "Creator", value: "creator" },
  { label: "Workstation", value: "workstation" },
  { label: "Small form factor", value: "sff" },
] as const;

const PRIMARY: { href: Route; label: string }[] = [
  { href: shellRoutes.prebuilts, label: "Prebuilts" },
  { href: shellRoutes.components, label: "Components" },
  { href: shellRoutes.build, label: "Build yours" },
  { href: shellRoutes.assistant, label: "Assistant" },
];

/* The eleven categories, in build order. "Components" above still goes to the
   unfiltered listing; this is the shortcut past it. */
const CATEGORIES = [...CATEGORY_DEFINITIONS].sort(
  (a, b) => a.sortOrder - b.sortOrder
);

interface MobileNavProps {
  initialUser?: HeaderAccountUser | null;
}

function MobileNav({ initialUser }: MobileNavProps = {}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? initialUser;

  const secondary: { href: Route; label: string }[] = user
    ? [
        { href: shellRoutes.account, label: "Orders & Account" },
        { href: shellRoutes.cart, label: "Cart" },
        { href: shellRoutes.contact, label: "Contact" },
      ]
    : [
        { href: shellRoutes.login, label: "Sign in" },
        { href: shellRoutes.cart, label: "Cart" },
        { href: shellRoutes.contact, label: "Contact" },
      ];

  /* Any navigation closes the panel, including a back button. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: closing is the effect of the path changing
  useEffect(() => setOpen(false), [pathname]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger
        aria-label="Menu"
        className="flex size-9 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:text-bone md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/70 transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-71 flex w-[320px] max-w-[88vw] flex-col overflow-y-auto bg-carbon shadow-float transition-transform duration-standard ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:translate-x-full data-starting-style:translate-x-full data-ending-style:duration-exit">
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <Dialog.Title className="t-display-sm text-bone">Menu</Dialog.Title>
            <button
              aria-label="Close menu"
              className="flex size-9 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:text-bone"
              onClick={close}
              type="button"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <nav className="px-6 pb-10">
            <ul className="mt-6">
              {PRIMARY.map((item) => (
                <li key={item.label}>
                  <Link
                    className="t-body-lg flex min-h-[52px] items-center text-bone"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Label className="mt-9 block">Shop by component</Label>
            <ul className="mt-3 grid grid-cols-2 gap-x-4">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    className="t-body flex min-h-[44px] items-center text-smoke"
                    href={shellRoutes.shopCategory(category.slug)}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>

            <Label className="mt-9 block">Shop by use</Label>
            <ul className="mt-3">
              {USE_CASES.map((useCase) => (
                <li key={useCase.value}>
                  <Link
                    className="t-body flex min-h-[44px] items-center text-smoke"
                    href={shellRoutes.byUse(useCase.value)}
                  >
                    {useCase.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Label className="mt-9 block">Your account</Label>
            <ul className="mt-3">
              {secondary.map((item) => (
                <li key={item.label}>
                  <Link
                    className="t-body flex min-h-[44px] items-center text-smoke hover:text-bone"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Pill
              className="mt-8 w-full justify-center"
              onClick={close}
              variant="ghost"
            >
              Close
            </Pill>
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { MobileNav };
