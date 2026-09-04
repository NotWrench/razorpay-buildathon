"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Pill } from "@workspace/ui/components/pill";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { StrengthMeter } from "@/components/auth/strength-meter";
import { ProductRender } from "@/components/common/product-render";
import { route, shellRoutes } from "@/lib/routes";

/**
 * Sign in and sign up, which are one screen.
 *
 * They share a layout, a left panel and every field but one, so moving between
 * them is a state change rather than a navigation: the right column's contents
 * crossfade and the URL is corrected with `history.pushState`. A full route
 * change here would blank and rebuild a screen that is 90% identical, which is
 * how a two-field difference comes to feel like a page load.
 *
 * Nothing is wired. `packages/auth` is ready and deliberately untouched —
 * `signIn.email`, `signUp.email` and `signIn.social` take exactly the values
 * this form already holds.
 */

type Mode = "login" | "signup";

interface Copy {
  heading: string;
  submit: string;
  swapHref: string;
  swapLabel: string;
  swapLead: string;
}

const COPY: Record<Mode, Copy> = {
  login: {
    heading: "Welcome back.",
    submit: "Sign in",
    swapHref: "/signup",
    swapLabel: "Create one",
    swapLead: "No account yet?",
  },
  signup: {
    heading: "Make an account.",
    submit: "Create account",
    swapHref: "/login",
    swapLabel: "Sign in",
    swapLead: "Already have an account?",
  },
};

/**
 * Schematic marks, not logos.
 *
 * Same rule the cart's payment row follows: drawing somebody else's trademark
 * into a demo is not a thing to do casually, so these are the simplest shapes
 * that read as "the Google one" and "the GitHub one" without reproducing
 * either mark.
 */
function ProviderGlyph({ provider }: { provider: "google" | "github" }) {
  if (provider === "google") {
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

  return (
    <svg aria-hidden fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 14v-2.4c0-.7.5-1.2 1-1.4M10 14v-2.4c0-.7-.5-1.2-1-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD = 8;

/** Returns the objection to a value, or null when there is none. */
function objection(field: string, value: string): string | null {
  if (field === "name") {
    return value.trim().length > 0 ? null : "We need something to call you.";
  }

  if (field === "email") {
    if (value.trim().length === 0) {
      return "An email address, please.";
    }

    return EMAIL_PATTERN.test(value.trim())
      ? null
      : "That does not look like an email address.";
  }

  if (value.length === 0) {
    return "A password, please.";
  }

  return value.length >= MIN_PASSWORD
    ? null
    : `Passwords are at least ${MIN_PASSWORD} characters.`;
}

function AuthScreen({ mode: initial }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [values, setValues] = useState({ email: "", name: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sent, setSent] = useState(false);

  const copy = COPY[mode];
  const fields =
    mode === "signup" ? ["name", "email", "password"] : ["email", "password"];

  const onChange = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    /* An objection is answered as soon as the answer is typed. */
    setErrors((current) =>
      current[name] ? { ...current, [name]: objection(name, value) } : current
    );
  }, []);

  const onBlur = useCallback((name: string) => {
    setValues((current) => {
      setErrors((existing) => ({
        ...existing,
        [name]: objection(name, current[name as keyof typeof current]),
      }));

      return current;
    });
  }, []);

  const swap = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const next: Mode = mode === "login" ? "signup" : "login";

      setErrors({});
      setSent(false);
      setMode(next);
      /* The URL catches up without a navigation; back still works. */
      window.history.pushState(null, "", `/${next}`);
    },
    [mode]
  );

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const found = Object.fromEntries(
        fields.map((field) => [
          field,
          objection(field, values[field as keyof typeof values]),
        ])
      );

      setErrors(found);
      setSent(Object.values(found).every((entry) => entry === null));
    },
    [fields, values]
  );

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
            <span className="t-display-sm font-bold text-bone">
              NEXUS
            </span>
            <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
          </Link>

          <p className="t-display-lg max-w-[19ch] font-bold text-bone leading-[1.1]">
            The only store where the assistant can check the parts fit.
          </p>

          <span />
        </div>
      </div>

      {/* Right: the column that changes. */}
      <div className="flex flex-1 items-center justify-center bg-carbon px-6 py-16">
        <div className="w-full max-w-[380px]" key={mode}>
          {/* The wordmark lives on the left panel, which is not here below lg —
              and a sign-in screen with no way back to the store is a trap. */}
          <Link
            className="mb-10 flex items-baseline gap-1 lg:hidden"
            href={shellRoutes.home}
          >
            <span className="t-display-sm font-bold text-bone">
              NEXUS
            </span>
            <span aria-hidden className="size-[5px] rounded-full bg-lacquer" />
          </Link>

          <div className="auth-swap">
            <h1 className="t-display-md text-bone leading-none">
              {copy.heading}
            </h1>

            <p className="t-body mt-3 text-smoke">
              {copy.swapLead}{" "}
              <Link
                className="text-bone underline-offset-4 hover:underline"
                href={route(copy.swapHref)}
                onClick={swap}
              >
                {copy.swapLabel}
              </Link>
            </p>

            <div className="mt-8 grid gap-3">
              <Pill className="w-full justify-center" disabled variant="ghost">
                <ProviderGlyph provider="google" />
                Continue with Google
              </Pill>
              <Pill className="w-full justify-center" disabled variant="ghost">
                <ProviderGlyph provider="github" />
                Continue with GitHub
              </Pill>
              <p className="t-body-sm text-center text-smoke">
                Social sign-in is not connected yet.
              </p>
            </div>

            <div className="my-8 flex items-center gap-4">
              <span className="h-px flex-1 bg-hairline" />
              <span className="t-body-sm text-smoke">or</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>

            <form className="grid gap-5" noValidate onSubmit={onSubmit}>
              {mode === "signup" ? (
                <AuthField
                  autoComplete="name"
                  error={errors.name ?? undefined}
                  label="Name"
                  name="name"
                  onBlur={onBlur}
                  onChange={onChange}
                  placeholder="Kavin Raj"
                  value={values.name}
                />
              ) : null}

              <AuthField
                autoComplete="email"
                error={errors.email ?? undefined}
                label="Email"
                name="email"
                onBlur={onBlur}
                onChange={onChange}
                placeholder="you@example.com"
                type="email"
                value={values.email}
              />

              <div>
                <AuthField
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  error={errors.password ?? undefined}
                  label="Password"
                  name="password"
                  onBlur={onBlur}
                  onChange={onChange}
                  type="password"
                  value={values.password}
                />
                {mode === "signup" ? (
                  <StrengthMeter value={values.password} />
                ) : null}
              </div>

              <Pill className="mt-1 w-full justify-center" type="submit">
                {copy.submit}
              </Pill>
            </form>

            {sent ? (
              <p className="t-body-sm mt-4 text-smoke">
                Everything checks out. Accounts are not wired up yet.
              </p>
            ) : null}

            <p className="t-body-sm mt-8 text-smoke leading-relaxed">
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
    </div>
  );
}

export type { Mode };
export { AuthScreen };
