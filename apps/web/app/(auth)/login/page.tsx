import { isGoogleConfigured } from "@workspace/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/auth-screen";
import { route } from "@/lib/routes";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The only sign-in screen. Google, and nothing else.
 *
 * `?next=` is honoured but only for same-origin paths: without that check a
 * crafted link could bounce somebody off-site the instant they authenticate,
 * with a fresh session cookie and the story that our own screen sent them.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  /* Already signed in — the screen has nothing left to ask. */
  if (await currentUser()) {
    redirect(route(target));
  }

  return <AuthScreen configured={isGoogleConfigured} next={target} />;
}
