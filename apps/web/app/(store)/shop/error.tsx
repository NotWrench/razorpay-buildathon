"use client";

import { RouteError } from "@/components/common/route-error";

/**
 * The catalogue's own boundary, kept separate from the group's so its line can
 * name what failed.
 */
export default function ShopError({ reset }: { reset: () => void }) {
  return <RouteError line="The catalogue did not answer." reset={reset} />;
}
