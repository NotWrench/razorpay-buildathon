import type { ReactNode } from "react";
import { ManagerRail } from "@/components/manager/manager-rail";

/**
 * The manager's room.
 *
 * Its own group, its own rail, none of the storefront's chrome — an operator
 * is not shopping. The rail is fixed and the content is inset by its width, so
 * a long summary scrolls under a navigation that stays put.
 *
 * The rail's height below `lg` is declared once as `--manager-rail`, because
 * the assistant screen has to subtract it to size its own scroll region and a
 * magic number written twice is a magic number that will disagree with itself.
 */
export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-void [--manager-rail:116px]">
      <ManagerRail />
      {/* The rail is a top bar below lg and a fixed column above it, so the
          content clears it in one direction or the other. */}
      <div className="pt-(--manager-rail) lg:pt-0 lg:pl-[220px]">
        {children}
      </div>
    </div>
  );
}
