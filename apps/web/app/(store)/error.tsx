"use client";

import { RouteError } from "@/components/common/route-error";

/** Covers every storefront route beneath it. */
export default function StoreError({ reset }: { reset: () => void }) {
  return <RouteError line="That did not load." reset={reset} />;
}
