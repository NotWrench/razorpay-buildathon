import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/store-shell";

/**
 * The storefront. Every page prompts 02 onwards adds lives in this group and
 * inherits the header, the footer and the route transition.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreShell cartCount={3}>{children}</StoreShell>;
}
