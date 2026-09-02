import type { ReactNode } from "react";
import { RouteFade } from "@/components/layout/route-fade";

/**
 * A template, not a layout: the router re-mounts this on every navigation,
 * which is what gives <RouteFade> a fresh timeline per route.
 */
export default function StoreTemplate({ children }: { children: ReactNode }) {
  return <RouteFade>{children}</RouteFade>;
}
