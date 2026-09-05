"use client";

import { Menu } from "@base-ui/react/menu";
import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { MaskOpen } from "@workspace/ui/components/motion/mask-open";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { shellRoutes } from "@/lib/routes";

/**
 * "Components" — a link that happens to have a menu.
 *
 * Clicking it goes to the unfiltered shop, the same as it always did. Hovering
 * it opens the eleven categories. Those are two different intents and this is
 * the only nav item that has both, so it is the only one that is not either a
 * plain `NavLink` or a plain `Menu`.
 *
 * Base UI's Menu has no `openOnHover` in this version, so `open` is controlled
 * here. Two details that a naive version gets wrong:
 *
 *   1. The popup is portalled, so it is not inside the trigger's hover area.
 *      Moving the mouse from one to the other would leave the wrapper and close
 *      the menu before the cursor arrived. Closing is therefore deferred, and
 *      entering the popup cancels it.
 *   2. A menu opened by hover must not take focus — that would move the caret
 *      away from whatever the person was doing just because a pointer crossed a
 *      word. Keyboard users get the menu from `Menu.Trigger`'s own handling and
 *      from the eleven tiles on the page the link goes to.
 */

const CATEGORIES = [...CATEGORY_DEFINITIONS].sort(
  (a, b) => a.sortOrder - b.sortOrder
);

/** Long enough to cross the gap to the popup, short enough not to linger. */
const CLOSE_AFTER = 120;

function ComponentMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const active = pathname.startsWith("/shop");

  const cancelClose = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const hide = useCallback(() => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), CLOSE_AFTER);
  }, [cancelClose]);

  /* A navigation unmounts nothing here — the header lives in the layout — so
     without this the menu stays open over the page it just took you to. The
     cleanup covers the unmount case with the same call. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read
  useEffect(() => {
    cancelClose();
    setOpen(false);

    return cancelClose;
  }, [cancelClose, pathname]);

  return (
    <Menu.Root modal={false} onOpenChange={setOpen} open={open}>
      <Menu.Trigger
        className={cn(
          "t-body relative flex items-center gap-1.5 py-1 transition-colors duration-micro",
          active || open ? "text-bone" : "text-smoke hover:text-bone"
        )}
        nativeButton={false}
        onMouseEnter={show}
        onMouseLeave={hide}
        render={<Link href={shellRoutes.components} />}
        role="link"
      >
        Components
        <ChevronDown aria-hidden className="size-3.5" />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-lacquer transition-transform duration-exit",
            active ? "scale-x-100" : "scale-x-0"
          )}
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={16}>
          {/*
            The popup carries the same hover handlers as the trigger. Without
            them the deferred close fires while the cursor is sitting inside the
            menu it is trying to use.
          */}
          <Menu.Popup
            className="w-[420px] overflow-hidden rounded-[28px] bg-panel p-2 shadow-float outline-none"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <MaskOpen>
              <Label className="block px-4 pt-3 pb-2">Shop by component</Label>

              <div className="grid grid-cols-2 gap-x-1">
                {CATEGORIES.map((category) => (
                  <Menu.LinkItem
                    className="t-body block rounded-[20px] px-4 py-2.5 text-bone outline-none transition-colors duration-micro data-highlighted:bg-riser"
                    key={category.slug}
                    render={
                      <Link href={shellRoutes.shopCategory(category.slug)} />
                    }
                  >
                    {category.name}
                  </Menu.LinkItem>
                ))}
              </div>

              <Menu.LinkItem
                className="t-body-sm mt-1 block rounded-[20px] px-4 py-3 text-smoke outline-none transition-colors duration-micro data-highlighted:bg-riser data-highlighted:text-bone"
                render={<Link href={shellRoutes.components} />}
              >
                Everything, unfiltered →
              </Menu.LinkItem>
            </MaskOpen>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { ComponentMenu };
