"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ManagerMenuItem, MENU_POPUP } from "@/components/manager/manager-menu";
import type { ManagerRange } from "@/lib/data/types";
import { managerRoutes } from "@/lib/routes";

/**
 * The window the whole page is about.
 *
 * Changing it re-fetches on the server rather than re-slicing something the
 * client already holds, so the skeletons are real and the numbers genuinely
 * belong to the range named above them. A range control that reorders the same
 * figures teaches the operator that the page is decorative.
 *
 * The trigger stays a quiet line rather than the ghost pill the catalogue's
 * menus wear: it sits directly under the greeting, and a bordered control
 * there would read as the page's primary action.
 */
function RangeMenu({
  current,
  ranges,
}: {
  current: ManagerRange;
  ranges: ManagerRange[];
}) {
  const router = useRouter();

  const onSelect = useCallback(
    (id: string) => router.push(managerRoutes.assistantWith(id)),
    [router]
  );

  return (
    <Menu.Root>
      <Menu.Trigger
        className="t-num-xs flex items-center gap-2 text-smoke outline-none transition-colors duration-micro hover:text-bone focus-visible:text-bone"
        render={<button type="button" />}
      >
        {current.label}
        <ChevronDown aria-hidden className="size-3.5" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8}>
          <Menu.Popup className={MENU_POPUP}>
            {ranges.map((range) => (
              <ManagerMenuItem
                key={range.id}
                onSelect={onSelect}
                selected={range.id === current.id}
                value={range.id}
              >
                {range.label}
              </ManagerMenuItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { RangeMenu };
