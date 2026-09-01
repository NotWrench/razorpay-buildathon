"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { route } from "@/lib/routes";

/**
 * Email and password, both directions.
 *
 * One form with a mode toggle rather than two pages: the fields are the same
 * and the difference is one call. Errors are shown from better-auth's own
 * response rather than being reworded, so a wrong password does not become a
 * vague "something went wrong".
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    const result =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({
            email,
            name: String(data.get("name") ?? email),
            password,
          });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "That did not work.");

      return;
    }

    router.push(route(redirectTo));
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {mode === "sign-up" ? (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input autoComplete="name" id="name" name="name" required />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button className="w-full" disabled={pending} type="submit">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>

      <button
        className="w-full text-center text-muted-foreground text-xs underline underline-offset-4"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        type="button"
      >
        {mode === "sign-in"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
