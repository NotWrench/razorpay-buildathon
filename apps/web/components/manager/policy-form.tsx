"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import type { StorePolicy } from "@/lib/data/types";

/**
 * The bounds the store chose, as a form.
 *
 * Until this existed, `merchant_policy` was read by the agent and published in
 * the discovery manifest but written by nothing — so "bounded" was a developer's
 * promise on the merchant's behalf, and the per-store block a counterparty
 * agent reads was the platform's numbers wearing the store's name.
 *
 * Three things make the screen honest.
 *
 * **The ceiling is visible while you choose.** Each field says the most this
 * deployment allows. A merchant cannot raise their own discount cap to 80%, and
 * finding that out after saving would read as the form losing their input.
 *
 * **The server clamps, and the clamp is shown.** The response carries the
 * *effective* policy, not the submitted one, and the page refreshes to it. Type
 * 50 into a field capped at 30 and 30 comes back — which is the truthful answer
 * to "as high as you'll let me".
 *
 * **Blank means default, not zero.** Every numeric column is nullable because
 * not configured and configured to nothing are different facts. Clearing a
 * field sends `null` and hands the bound back to the platform.
 */

const FIELD =
  "mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 font-mono text-[15px] text-bone outline-none transition-colors duration-[180ms] focus:border-bone";

const FALLBACK = "Those bounds could not be saved.";

async function reasonFor(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };

    return body.error?.message ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Paise in the database, rupees in the field. Nobody types paise. */
function toRupees(paise: number): string {
  return String(Math.round(paise / 100));
}

/**
 * Reads one numeric field.
 *
 * An empty string is `null` — "hand this back to the platform default" — and
 * has to stay distinguishable from a typed zero, which is a real choice.
 */
function readNumber(
  form: FormData,
  name: string,
  scale = 1
): number | null | undefined {
  const raw = String(form.get(name) ?? "").trim();

  if (raw === "") {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) && value >= 0
    ? Math.round(value * scale)
    : undefined;
}

function NumberField({
  ceiling,
  defaultValue,
  label,
  name,
  note,
}: {
  ceiling: string;
  defaultValue: string;
  label: string;
  name: string;
  note: string;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <span className="t-body-sm shrink-0 text-smoke">max {ceiling}</span>
      </div>
      <input
        className={FIELD}
        defaultValue={defaultValue}
        id={id}
        inputMode="numeric"
        name={name}
        placeholder="platform default"
      />
      <p className="t-body-sm mt-2 max-w-[46ch] text-smoke leading-relaxed">
        {note}
      </p>
    </div>
  );
}

function PolicyForm({
  merchantId,
  policy,
}: {
  merchantId: string;
  policy: StorePolicy;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const approvalId = useId();

  const { ceilings, effective } = policy;

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);

      const update = {
        agentOrdersRequireApproval: form.get("approval") === "on",
        autoApproveCeilingPaise: readNumber(form, "autoApprove", 100),
        marginFloorPercent: readNumber(form, "marginFloor"),
        maxDiscountPercent: readNumber(form, "maxDiscount"),
        maxPriceMovePercent: readNumber(form, "maxPriceMove"),
        merchantId,
        spendCapPaise: readNumber(form, "spendCap", 100),
      };

      if (Object.values(update).includes(undefined)) {
        toast.error("Those need to be whole numbers, or blank.");

        return;
      }

      setSaving(true);

      try {
        const response = await fetch("/api/merchants/policy", {
          body: JSON.stringify(update),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        });

        if (!response.ok) {
          toast.error(await reasonFor(response));

          return;
        }

        const body = (await response.json()) as {
          data?: { changed?: string[] };
        };
        const changed = body.data?.changed?.length ?? 0;

        /* The count comes from the server's before/after comparison of the
           *effective* policy, so "nothing changed" is the honest answer when a
           merchant asks for something the ceiling already refused. */
        toast.success(
          changed === 0
            ? "Nothing changed — those are already the bounds in force."
            : `${changed} bound${changed === 1 ? "" : "s"} updated.`
        );

        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [merchantId, router]
  );

  return (
    <form className="grid gap-7" onSubmit={onSubmit}>
      <p className="t-body max-w-[52ch] text-smoke leading-relaxed">
        {effective.merchantConfigured
          ? "These are your store's bounds. They apply to the assistant, to any buying agent you issue a key to, and they are published in your discovery manifest."
          : "This store runs on the platform defaults. Anything you set here can only be stricter, and is published in your discovery manifest so a buying agent knows the rules before it engages."}
      </p>

      <NumberField
        ceiling={`${ceilings.maxDiscountPercent}%`}
        defaultValue={String(effective.maxDiscountPercent)}
        label="Discount cap (%)"
        name="maxDiscount"
        note="The deepest discount a campaign may offer."
      />

      <NumberField
        ceiling={`${ceilings.maxPriceMovePercent}%`}
        defaultValue={String(effective.maxPriceMovePercent)}
        label="Price move cap (%)"
        name="maxPriceMove"
        note="How far one price change may move a price. Two moves per product per day, whatever this says."
      />

      <NumberField
        ceiling="no floor"
        defaultValue={String(effective.marginFloorPercent)}
        label="Margin floor (%)"
        name="marginFloor"
        note="The thinnest margin a discount may leave. Zero means never below cost. Products with no recorded cost are skipped rather than blocked."
      />

      <NumberField
        ceiling={`₹${Number(toRupees(ceilings.spendCapPaise)).toLocaleString("en-IN")}`}
        defaultValue={toRupees(effective.spendCapPaise)}
        label="Spend cap per buyer (₹)"
        name="spendCap"
        note="The most one buyer may commit at this store in a conversation. A key you issue may carry a lower cap of its own."
      />

      <div className="border-hairline border-t pt-7">
        <label
          className="flex cursor-pointer items-start gap-4"
          htmlFor={approvalId}
        >
          <input
            className="mt-1 size-4 shrink-0 accent-bone"
            defaultChecked={effective.agentOrdersRequireApproval}
            id={approvalId}
            name="approval"
            type="checkbox"
          />
          <span>
            <span className="t-body block text-bone">
              Every agent order waits for me
            </span>
            <span className="t-body-sm mt-1 block max-w-[46ch] text-smoke leading-relaxed">
              The one bound here you may loosen, and deliberately so — switching
              it off is the difference between this store and one that lets
              strangers' software spend your money unattended. Turning it off is
              recorded in your activity log.
            </span>
          </span>
        </label>
      </div>

      <NumberField
        ceiling={`₹${Number(toRupees(ceilings.autoApproveCeilingPaise)).toLocaleString("en-IN")}`}
        defaultValue={toRupees(effective.autoApproveCeilingPaise)}
        label="Unattended ceiling (₹)"
        name="autoApprove"
        note="Only read when the box above is unchecked: orders under this do not wait for you. The platform ships this at zero."
      />

      <div>
        <Pill disabled={saving} size="sm" type="submit">
          {saving ? "Saving…" : "Save bounds"}
        </Pill>
      </div>
    </form>
  );
}

export { PolicyForm };
