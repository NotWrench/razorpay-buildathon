"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Pill } from "@workspace/ui/components/pill";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ProductRender } from "@/components/common/product-render";
import { signIn } from "@/lib/auth-client";
import { shellRoutes } from "@/lib/routes";

/**
 * Signing in, which is one button.
 *
 * Google is the only provider, so there is no sign-up screen, no password
 * field, no strength meter and no "or" divider — an account is created the
 * first time somebody presses this, and the second time it is a sign-in. The
 * screen that used to switch between two nearly identical modes now has one
 * thing on it.
 *
 * `signIn.social` redirects the browser to Google, so there is no success
 * branch here: the promise only ever resolves locally when the redirect was
 * refused, which is the case the error state is for.
 */

/**
 * A schematic mark, not a logo.
 *
 * Same rule the cart's payment row follows: drawing somebody else's trademark
 * into a demo is not a thing to do casually, so this is the simplest shape
 * that reads as "the Google one" without reproducing the mark.
 */
function GoogleGlyph() {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 16 16">
      <path
        d="M14 8a6 6 0 1 1-1.8-4.3M14 8H8"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

interface AuthScreenProps {
  /**
   * False when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are unset.
   *
   * Resolved on the server and passed down, because the alternative is a
   * button that redirects into a Google error page and a developer with no
   * idea which of the two ends is misconfigured.
   */
  configured: boolean;
  /** Where to land after Google sends the browser back. Same-origin only. */
  next: string;
}

function AuthScreen({ configured, next }: AuthScreenProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = useCallback(async () => {
    setPending(true);
    setError(null);

    const result = await signIn.social({
      callbackURL: next,
      errorCallbackURL: "/login",
      provider: "google",
    });

    /* Reached only when the redirect never happened. */
    setPending(false);

    if (result?.error) {
      setError(result.error.message ?? "Google would not take us just now.");
    }
  }, [next]);

  const start = useCallback(() => {
    onGoogle().catch(() => {
      setPending(false);
      setError("Google would not take us just now.");
    });
  }, [onGoogle]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: one claim, on a render, and nothing else. */}
      <div className="relative isolate hidden lg:block lg:w-[45%]">
        <ImageGround className="absolute inset-0 rounded-none">
          <ProductRender
            alt=""
            category="case"
            className="h-[92%] w-auto opacity-40"
          />
        </ImageGround>

        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(160deg,rgba(6,6,6,0.55)_0%,rgba(6,6,6,0.88)_100%)]"
        />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link className="flex items-baseline gap-1" href={shellRoutes.home}>
            <span className="font-bold font-display text-[21px] text-bone tracking-[-0.02em]">
              NEXUS
            </span>
            <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
          </Link>

          <p className="max-w-[19ch] font-bold font-display text-[40px] text-bone leading-[1.1] tracking-[-0.03em]">
            The only store where the assistant can check the parts fit.
          </p>

          <span />
        </div>
      </div>

      {/* Right: the button. */}
      <div className="flex flex-1 items-center justify-center bg-carbon px-6 py-16">
        <div className="w-full max-w-[380px]">
          {/* The wordmark lives on the left panel, which is not here below lg —
              and a sign-in screen with no way back to the store is a trap. */}
          <Link
            className="mb-10 flex items-baseline gap-1 lg:hidden"
            href={shellRoutes.home}
          >
            <span className="font-bold font-display text-[21px] text-bone tracking-[-0.02em]">
              NEXUS
            </span>
            <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
          </Link>

          <h1 className="font-display font-semibold text-[28px] text-bone leading-none tracking-[-0.02em]">
            Sign in.
          </h1>

          <p className="mt-3 text-[15px] text-smoke leading-relaxed">
            Shopping does not need an account. This is for the two things that
            do — keeping your orders across devices, and the manager side of a
            store.
          </p>

          <div className="mt-8">
            <Pill
              className="w-full justify-center"
              disabled={!configured || pending}
              onClick={start}
              variant="ghost"
            >
              <GoogleGlyph />
              {pending ? "Taking you to Google…" : "Continue with Google"}
            </Pill>
          </div>

          {configured ? null : (
            <p className="mt-4 text-[13px] text-amber leading-relaxed">
              Google sign-in is not configured. Set{" "}
              <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in the
              workspace <code className="font-mono">.env</code>, with{" "}
              <code className="font-mono">/api/auth/callback/google</code>{" "}
              registered as a redirect URI.
            </p>
          )}

          {error ? (
            <p className="mt-4 text-[13px] text-amber leading-relaxed">
              {error}
            </p>
          ) : null}

          <p className="mt-8 text-[13px] text-smoke leading-relaxed">
            By continuing you agree to the{" "}
            <Link
              className="text-bone underline-offset-4 hover:underline"
              href={shellRoutes.home}
            >
              terms
            </Link>{" "}
            and the{" "}
            <Link
              className="text-bone underline-offset-4 hover:underline"
              href={shellRoutes.home}
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export { AuthScreen };
