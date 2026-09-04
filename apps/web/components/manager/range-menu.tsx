"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ManagerRange } from "@/lib/data/types";
import { managerRoutes } from "@/lib/routes";

/**
 * The window the whole page is about.
 *
 * Changing it re-fetches on the server rather than re-slicing something the
 * client already holds, so the skeletons are real and the numbers genuinely
 * belong to the range named above them. A range control that reorders the same
 * figures teaches the operator that the page is decorative.
 */

function RangeItem({
  onSelect,
  range,
}: {
  onSelect: (id: string) => void;
  range: ManagerRange;
}) {
  const choose = useCallback(() => onSelect(range.id), [onSelect, range.id]);

  return (
    <Menu.Item
      className="t-body cursor-default rounded-[16px] px-4 py-2.5 text-bone outline-none transition-colors duration-micro data-highlighted:bg-riser"
      onClick={choose}
    >
      {range.label}
    </Menu.Item>
  );
}

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
          <Menu.Popup className="surface-float min-w-[200px] rounded-[20px] border border-hairline bg-panel p-1.5 outline-none">
            {ranges.map((range) => (
              <RangeItem key={range.id} onSelect={onSelect} range={range} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { RangeMenu };
