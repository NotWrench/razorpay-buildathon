"use client";

import { RouteError } from "@/components/common/route-error";

/** Covers the summary and all four editing surfaces. */
export default function ManagerError({ reset }: { reset: () => void }) {
  return (
    <RouteError line="The store's numbers did not answer." reset={reset} />
  );
}
