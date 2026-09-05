"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";

/**
 * The one popup on the manager side.
 *
 * The range picker and the catalogue's sort and filter controls were three
 * popups with three sets of numbers in them. The chrome lives here now; the
 * triggers differ because they are doing different jobs — the range is a quiet
 * line under a heading, sort and filter are controls you have to be able to
 * see.
 */

const MENU_POPUP =
  "surface-float z-50 min-w-[220px] rounded-[20px] border border-hairline bg-panel p-1.5 outline-none";

/** A row in a popup. `selected` gets the tick, not a fill. */
function ManagerMenuItem({
  children,
  onSelect,
  selected,
  value,
}: {
  children: ReactNode;
  onSelect: (value: string) => void;
  selected?: boolean;
  value: string;
}) {
  const choose = useCallback(() => onSelect(value), [onSelect, value]);

  return (
    <Menu.Item
      className="t-body-sm flex cursor-default items-center justify-between gap-5 rounded-[14px] px-4 py-2.5 text-bone outline-none transition-colors duration-micro data-highlighted:bg-riser"
      onClick={choose}
    >
      <span className="min-w-0 truncate">{children}</span>
      {selected ? (
        <Check aria-hidden className="size-3.5 shrink-0 text-bone" />
      ) : null}
    </Menu.Item>
  );
}

/** A heading inside a popup, for menus that hold more than one list. */
function ManagerMenuGroup({ label }: { label: string }) {
  return (
    <p className="t-label px-4 pt-3 pb-1.5 text-smoke first:pt-1.5">{label}</p>
  );
}

/**
 * A ghost-pill trigger and its popup.
 *
 * `value` is the current choice rendered beside the label, so the control says
 * what it is set to without being opened.
 */
function ManagerMenu({
  align = "start",
  children,
  label,
  value,
}: {
  align?: "start" | "end";
  children: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "t-body-sm inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hairline px-4 font-medium text-bone",
          "outline-none transition-colors duration-micro hover:border-smoke",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-[3px]"
        )}
        render={<button type="button" />}
      >
        {label}
        {value ? <span className="t-num-xs text-smoke">{value}</span> : null}
        <ChevronDown aria-hidden className="size-3.5 text-smoke" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align={align} sideOffset={8}>
          <Menu.Popup className={MENU_POPUP}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { ManagerMenu, ManagerMenuGroup, ManagerMenuItem, MENU_POPUP };
