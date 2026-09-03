import type { ReactNode } from "react";
import { ManagerRail } from "@/components/manager/manager-rail";

/**
 * The manager's room.
 *
 * Its own group, its own rail, none of the storefront's chrome — an operator
 * is not shopping. The rail is fixed and the content is inset by its width, so
 * a long summary scrolls under a navigation that stays put.
 */
export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-void">
      <ManagerRail />
      {/* The rail is a top bar below lg and a fixed column above it, so the
          content clears it in one direction or the other. */}
      <div className="pt-[116px] lg:pt-0 lg:pl-[220px]">{children}</div>
    </div>
  );
}
