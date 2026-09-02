import type { ReactNode } from "react";

/**
 * Sign in and sign up carry their own chrome — the wordmark sits on the left
 * panel and there is nothing else to navigate to. They sit outside the (store)
 * group for the same reason the assistant does.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-void">{children}</div>;
}
