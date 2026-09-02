"use client";

import { RouteError } from "@/components/common/route-error";

/** Sign in and sign up. */
export default function AuthError({ reset }: { reset: () => void }) {
  return <RouteError line="That screen did not load." reset={reset} />;
}
