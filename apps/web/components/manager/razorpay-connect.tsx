"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import type { RazorpayConnection } from "@/lib/data/types";
import { route } from "@/lib/routes";

/**
 * Connecting the store's own Razorpay account.
 *
 * Not connecting is a working state rather than a broken one — everything
 * downstream falls back to the platform keys — so this section reads as "which
 * account is taking the money", and the button is an upgrade rather than an
 * alarm.
 *
 * The secret is typed here and never comes back: `PUT /api/merchants/razorpay`
 * writes it, no endpoint returns it, and the key id is masked everywhere it is
 * shown. That route also asks Razorpay whether the pair actually works before
 * saving it, so a typo fails on this screen rather than at somebody's
 * checkout.
 */

const POPUP =
  "fixed top-1/2 left-1/2 z-71 w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-panel p-7 shadow-float outline-none transition-opacity duration-[420ms] data-ending-style:opacity-0 data-ending-style:duration-[280ms] data-starting-style:opacity-0";

const BACKDROP =
  "fixed inset-0 z-70 bg-void/80 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0";

const FIELD =
  "mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 font-mono text-[15px] text-bone outline-none transition-colors duration-[180ms] focus:border-bone";

/* Test keys only. The server refuses live credentials outright while the
   build runs in test mode, so accepting one here would only be a slower way
   of saying no. */
const KEY_PATTERN = /^rzp_test_[A-Za-z0-9]+$/;

const MIN_SECRET = 8;

const FALLBACK_REASON = "Razorpay could not be connected.";

/** Reads `{ error: { message } }` off a failed response without assuming it. */
async function reasonFor(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };

    return body.error?.message ?? FALLBACK_REASON;
  } catch {
    return FALLBACK_REASON;
  }
}

/**
 * Test or live, said plainly.
 *
 * Live is the only one that wears lacquer. An operator should never have to
 * work out from a key prefix whether the next order moves real money.
 */
function ModeBadge({ mode }: { mode: "live" | "test" }) {
  return (
    <span
      className={
        mode === "live"
          ? "shrink-0 rounded-full border border-lacquer px-3 py-1 text-[12px] text-lacquer uppercase tracking-[0.08em]"
          : "shrink-0 rounded-full border border-hairline px-3 py-1 text-[12px] text-smoke uppercase tracking-[0.08em]"
      }
    >
      {mode === "live" ? "Live mode" : "Test mode"}
    </span>
  );
}

function ConnectDialog({
  connected,
  merchantId,
  onOpenChange,
  open,
}: {
  connected: boolean;
  merchantId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const keyFieldId = useId();
  const secretFieldId = useId();
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback(
    (next: boolean) => {
      if (!next) {
        setKeyId("");
        setKeySecret("");
        setError(null);
      }

      onOpenChange(next);
    },
    [onOpenChange]
  );

  const cancel = useCallback(() => change(false), [change]);

  const onKeyId = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setKeyId(event.target.value),
    []
  );

  const onKeySecret = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setKeySecret(event.target.value),
    []
  );

  const submit = useCallback(async () => {
    const trimmedKey = keyId.trim();
    const trimmedSecret = keySecret.trim();

    /* Checked here as well as on the server, so an obvious typo costs a glance
       rather than a round trip through Razorpay. */
    if (!KEY_PATTERN.test(trimmedKey)) {
      setError(
        trimmedKey.startsWith("rzp_live_")
          ? "This build runs in test mode. Paste the rzp_test_ pair instead."
          : "A key id looks like rzp_test_xxxxxxxxxxxx."
      );

      return;
    }

    if (trimmedSecret.length < MIN_SECRET) {
      setError("That secret looks too short to be one.");

      return;
    }

    setPending(true);
    setError(null);

    const response = await fetch("/api/merchants/razorpay", {
      body: JSON.stringify({
        keyId: trimmedKey,
        keySecret: trimmedSecret,
        merchantId,
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    setPending(false);

    if (!response.ok) {
      setError(await reasonFor(response));

      return;
    }

    change(false);
    toast.success(
      "Connected. This store takes test payments through your account."
    );
    router.refresh();
  }, [change, keyId, keySecret, merchantId, router]);

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      submit().catch(() => {
        setPending(false);
        setError("Razorpay could not be reached just now.");
      });
    },
    [submit]
  );

  return (
    <Dialog.Root onOpenChange={change} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Popup className={POPUP}>
          <Dialog.Title className="font-display font-semibold text-[21px] text-bone tracking-[-0.02em]">
            {connected ? "Update the Razorpay keys" : "Connect Razorpay"}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-[15px] text-smoke leading-relaxed">
            Paste an API key pair from your Razorpay dashboard, under Settings
            &rarr; API Keys. This build takes{" "}
            <code className="font-mono">rzp_test_</code> keys only: the checkout
            window opens in test mode and no real money moves. A{" "}
            <code className="font-mono">rzp_live_</code> key is refused.
          </Dialog.Description>

          <form className="mt-6 grid gap-5" noValidate onSubmit={onSubmit}>
            <div>
              <Label htmlFor={keyFieldId}>Key id</Label>
              <input
                autoComplete="off"
                className={FIELD}
                id={keyFieldId}
                onChange={onKeyId}
                placeholder="rzp_test_1234567890abcd"
                spellCheck={false}
                value={keyId}
              />
            </div>

            <div>
              <Label htmlFor={secretFieldId}>Key secret</Label>
              <input
                autoComplete="off"
                className={FIELD}
                id={secretFieldId}
                onChange={onKeySecret}
                spellCheck={false}
                type="password"
                value={keySecret}
              />
              <p className="mt-2 pl-5 text-[13px] text-smoke">
                Stored on the store and never shown again.
              </p>
            </div>

            {error ? (
              <p className="text-[13px] text-amber leading-relaxed">{error}</p>
            ) : null}

            <div className="mt-1 flex items-center justify-end gap-4">
              <Pill onClick={cancel} size="sm" variant="ghost">
                Cancel
              </Pill>
              <Pill disabled={pending} size="sm" type="submit">
                {pending ? "Checking with Razorpay…" : "Connect"}
              </Pill>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface RazorpayConnectProps {
  isOwner: boolean;
  merchantId: string;
  ownerEmail: string | null;
  razorpay: RazorpayConnection;
}

function RazorpayConnect({
  isOwner,
  merchantId,
  ownerEmail,
  razorpay,
}: RazorpayConnectProps) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const openConnect = useCallback(() => setConnecting(true), []);
  const openDisconnect = useCallback(() => setDisconnecting(true), []);

  const disconnect = useCallback(() => {
    fetch(`/api/merchants/razorpay?merchantId=${merchantId}`, {
      method: "DELETE",
    })
      .then(async (response) => {
        if (response.ok) {
          toast(
            "Disconnected. Orders bill through the platform account again."
          );
          router.refresh();

          return;
        }

        toast.error(await reasonFor(response));
      })
      .catch(() => toast.error("That could not be undone just now."));
  }, [merchantId, router]);

  /* The store's own mode when it has keys, otherwise the platform's — either
     way, the mode the next order will actually be charged in. */
  const mode = razorpay.mode ?? razorpay.platformMode;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[15px] text-bone">
            {razorpay.connected
              ? "This store's own Razorpay account"
              : "The platform's Razorpay account"}
          </p>
          <p className="mt-2 font-mono text-[15px] text-smoke tabular-nums">
            {razorpay.keyId ?? "No keys of its own"}
          </p>
        </div>

        {mode ? <ModeBadge mode={mode} /> : null}
      </div>

      <p className="mt-4 max-w-[52ch] text-[15px] text-smoke leading-relaxed">
        {razorpay.connected
          ? "Checkout, payment links and refunds all run through these keys."
          : "Checkout works either way — orders are settled through the platform's keys until this store connects its own."}
      </p>

      {isOwner ? (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Pill
            onClick={openConnect}
            size="sm"
            variant={razorpay.connected ? "ghost" : "solid"}
          >
            {razorpay.connected ? "Update keys" : "Connect Razorpay"}
          </Pill>

          {razorpay.connected ? (
            <Pill
              className="text-lacquer hover:text-ember"
              onClick={openDisconnect}
              size="sm"
              variant="text"
            >
              Disconnect
            </Pill>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 max-w-[52ch] text-[13px] text-smoke leading-relaxed">
          Only the store&rsquo;s owner can change this
          {ownerEmail ? ` — sign in as ${ownerEmail}` : ""}.{" "}
          <Link
            className="text-bone underline underline-offset-4"
            href={route("/login?next=/manager/account")}
          >
            Sign in
          </Link>
          .
        </p>
      )}

      <ConnectDialog
        connected={razorpay.connected}
        merchantId={merchantId}
        onOpenChange={setConnecting}
        open={connecting}
      />

      <ConfirmDialog
        body="Orders go back to being settled through the platform's Razorpay account. Nothing already paid is affected."
        confirmLabel="Disconnect"
        onConfirm={disconnect}
        onOpenChange={setDisconnecting}
        open={disconnecting}
        title="Disconnect Razorpay"
      />
    </div>
  );
}

export { RazorpayConnect };
