import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const dynamic = "force-dynamic";

/**
 * Sign in.
 *
 * Shopping does not require an account — a guest cart works — so this is for
 * the two things that do: keeping orders across devices, and reaching the
 * merchant dashboard.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-origin paths, so a crafted `next` cannot bounce someone off-site
  // straight after they authenticate.
  const redirectTo = next?.startsWith("/") ? next : "/dashboard";

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-heading font-semibold text-2xl tracking-tight">
        Sign in
      </h1>
      <p className="mt-1 mb-6 text-muted-foreground text-sm">
        The seeded merchant is merchant@example.com with the password the seed
        script prints.
      </p>

      <SignInForm redirectTo={redirectTo} />

      <Link
        className="mt-6 text-center text-muted-foreground text-xs underline underline-offset-4"
        href="/"
      >
        Back to the stores
      </Link>
    </main>
  );
}
