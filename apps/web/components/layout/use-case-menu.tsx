"use client";

import { Menu } from "@base-ui/react/menu";
import { Label } from "@workspace/ui/components/label";
import { MaskOpen } from "@workspace/ui/components/motion/mask-open";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { shellRoutes } from "@/lib/routes";

/**
 * "Shop by use" — the second half of ORIGIN's nav, where product type and use
 * case sit side by side.
 *
 * Base UI's Menu rather than its Popover: the four rows have to be
 * arrow-key navigable and close on Escape, and Menu is the part that does
 * that for free. The popup itself is still a plain panel, not a menu bar.
 */

const USE_CASES = [
  { blurb: "1080p to 4K, high refresh", label: "Gaming", value: "gaming" },
  { blurb: "Edit, render, stream", label: "Creator", value: "creator" },
  { blurb: "Simulation and CAD", label: "Workstation", value: "workstation" },
  {
    blurb: "Full power, half the volume",
    label: "Small form factor",
    value: "sff",
  },
] as const;

function UseCaseMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-1.5 text-[15px] text-smoke transition-colors duration-[180ms] hover:text-bone data-popup-open:text-bone">
        Shop by use
        <ChevronDown aria-hidden className="size-3.5" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={16}>
          <Menu.Popup className="w-[320px] overflow-hidden rounded-[28px] bg-panel p-2 shadow-float outline-none">
            <MaskOpen>
              <Label className="block px-4 pt-3 pb-2">Shop by use</Label>
              {USE_CASES.map((useCase) => (
                <Menu.LinkItem
                  className="block rounded-[20px] px-4 py-3 outline-none transition-colors duration-[180ms] data-highlighted:bg-riser"
                  key={useCase.value}
                  render={<Link href={shellRoutes.byUse(useCase.value)} />}
                >
                  <span className="block text-[15px] text-bone">
                    {useCase.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-smoke">
                    {useCase.blurb}
                  </span>
                </Menu.LinkItem>
              ))}
            </MaskOpen>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { UseCaseMenu };
