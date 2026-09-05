"use client";

import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";

/**
 * The buyer's own bound, as a form.
 *
 * The mirror of `/manager/account`, and it exists for the same reason: until a
 * bound is something the person it protects can see and change, "bounded" is a
 * developer's promise made on their behalf.
 *
 * What it authorises is worth stating plainly on the screen rather than in a
 * tooltip, because it is genuinely unusual — the assistant may complete a
 * purchase without stopping to ask. The numbers are the whole safeguard, so
 * they are shown while the buyer chooses them, and the withdrawal is one
 * button on the same panel rather than buried in a settings page. An
 * authorisation you cannot find your way back to is not revocable in any sense
 * that matters.
 */

export interface MandateView {
  expiresAt: string;
  id: string;
  instrument: string;
  maxPerOrderPaise: number;
  maxTotalPaise: number;
  spentPaise: number;
}

const FIELD =
  "mt-2 h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none transition-colors focus:border-foreground";

const FALLBACK = "That could not be saved.";

async function reasonFor(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };

    return body.error?.message ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * A local copy on purpose.
 *
 * `formatPaise` lives in `@workspace/payments`, and importing it here would
 * pull the database client and the Razorpay SDK into the client bundle for the
 * sake of one Intl call. The rule it duplicates is small and stated in both
 * places: no decimals on whole rupees, two when there are paise, never one.
 */
function rupees(paise: number): string {
  const value = paise / 100;
  const decimals = Number.isInteger(value) ? 0 : 2;

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    style: "currency",
  }).format(value);
}

function Established({
  mandate,
  onRevoked,
}: {
  mandate: MandateView;
  onRevoked: () => void;
}) {
  const [working, setWorking] = useState(false);
  const remaining = Math.max(0, mandate.maxTotalPaise - mandate.spentPaise);

  const revoke = useCallback(async () => {
    setWorking(true);

    try {
      const response = await fetch(
        `/api/payments/mandates/${mandate.id}/revoke`,
        { method: "POST" }
      );

      if (!response.ok) {
        toast.error(await reasonFor(response));

        return;
      }

      toast.success("Withdrawn. Nothing can be charged without you again.");
      onRevoked();
    } finally {
      setWorking(false);
    }
  }, [mandate.id, onRevoked]);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Per order</dt>
          <dd className="font-mono">{rupees(mandate.maxPerOrderPaise)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Left in total</dt>
          <dd className="font-mono">{rupees(remaining)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Until</dt>
          <dd className="font-mono">
            {new Date(mandate.expiresAt).toDateString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Settles through</dt>
          <dd className="font-mono">
            {/*
             * Said out loud rather than hidden. A buyer whose store has no
             * recurring entitlement is authorising something that will be
             * recorded as simulated, and finding that out afterwards would be
             * the one thing this whole feature cannot afford.
             */}
            {mandate.instrument === "recurring" ? "Razorpay" : "simulated"}
          </dd>
        </div>
      </dl>

      <Button
        disabled={working}
        onClick={revoke}
        size="sm"
        type="button"
        variant="outline"
      >
        {working ? "Withdrawing…" : "Withdraw this authorisation"}
      </Button>
    </div>
  );
}

export function MandatePanel({
  mandate,
  slug,
}: {
  mandate: MandateView | null;
  slug: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const perOrderId = useId();
  const totalId = useId();
  const daysId = useId();

  const refresh = useCallback(() => router.refresh(), [router]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaving(true);

      try {
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/payments/mandates", {
          body: JSON.stringify({
            days: Number(form.get("days")),
            // Rupees on the screen, paise in the database. Nobody types paise.
            maxPerOrderPaise: Math.round(Number(form.get("perOrder")) * 100),
            maxTotalPaise: Math.round(Number(form.get("total")) * 100),
            slug,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          toast.error(await reasonFor(response));

          return;
        }

        toast.success("Authorised. You can withdraw this at any time.");
        refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh, slug]
  );

  return (
    <section className="mt-8 rounded-lg border border-border p-5">
      <h2 className="font-heading font-semibold text-lg tracking-tight">
        Letting the assistant pay
      </h2>
      <p className="mt-1 max-w-[62ch] text-muted-foreground text-sm leading-relaxed">
        {mandate
          ? "This store may complete a purchase for you without asking, within the bounds below. Anything over them still comes back to you."
          : "By default every payment stops for you. You can authorise this store to charge you within bounds you set — the assistant can then finish a purchase on its own, and nothing outside those bounds ever goes through."}
      </p>

      <div className="mt-5">
        {mandate ? (
          <Established mandate={mandate} onRevoked={refresh} />
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor={perOrderId}>Most per order (₹)</Label>
                <input
                  className={FIELD}
                  defaultValue="5000"
                  id={perOrderId}
                  inputMode="numeric"
                  name="perOrder"
                  required
                />
              </div>
              <div>
                <Label htmlFor={totalId}>Most in total (₹)</Label>
                <input
                  className={FIELD}
                  defaultValue="20000"
                  id={totalId}
                  inputMode="numeric"
                  name="total"
                  required
                />
              </div>
              <div>
                <Label htmlFor={daysId}>For how many days</Label>
                <input
                  className={FIELD}
                  defaultValue="30"
                  id={daysId}
                  inputMode="numeric"
                  name="days"
                  required
                />
              </div>
            </div>

            <Button disabled={saving} size="sm" type="submit">
              {saving ? "Authorising…" : "Authorise this store"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
