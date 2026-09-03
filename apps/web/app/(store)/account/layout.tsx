import type { ReactNode } from "react";
import { AccountRail } from "@/components/account/account-rail";

/**
 * The rail is the layout, so it survives the move between the profile and the
 * settings without remounting — which is the whole reason the marker can slide
 * rather than blink.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pt-14 pb-32 sm:px-8 lg:px-10 2xl:px-16">
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
        <AccountRail />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
