import { ButtonLink } from "@/components/common/button-link";

/**
 * What to do when the dashboard has nothing to show.
 *
 * Two different problems with two different fixes — not signed in, or signed
 * in without a store — so they are named separately rather than collapsed into
 * "unavailable".
 */
export function NoStoreNotice({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-heading font-semibold text-xl">
        {signedIn ? "No store on this account" : "Sign in to continue"}
      </h1>

      <p className="mt-2 text-muted-foreground text-sm">
        {signedIn
          ? "This account does not own a store yet. Create one with POST /api/merchants, or run bun run seed to set up the demo store."
          : "The merchant dashboard needs a signed-in store owner. The seed script creates merchant@example.com."}
      </p>

      {signedIn ? null : (
        <ButtonLink className="mt-4" href="/sign-in">
          Sign in
        </ButtonLink>
      )}
    </div>
  );
}
