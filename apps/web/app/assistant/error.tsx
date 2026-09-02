"use client";

import { RouteError } from "@/components/common/route-error";

/** The assistant, when its own page fails to render. */
export default function AssistantError({ reset }: { reset: () => void }) {
  return <RouteError line="The assistant did not load." reset={reset} />;
}
