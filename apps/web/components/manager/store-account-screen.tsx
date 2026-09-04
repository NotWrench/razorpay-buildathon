"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useId } from "react";
import { RazorpayConnect } from "@/components/manager/razorpay-connect";
import { useAction } from "@/hooks/use-action";
import { renameStoreAction } from "@/lib/actions/manager";
import type { StoreSettings } from "@/lib/data/types";

/**
 * The store's own settings. No cards, no analysis, no numbers worth counting.
 *
 * The Razorpay key is masked and stays masked: a screen that prints a live key
 * in full is one screenshot away from being an incident, and there is nothing
 * an operator does here that needs the whole string.
 *
 * Two controls used to live here that did nothing: an Invite button that
 * drafted an invitation nowhere, and a Close store dialog that admitted in its
 * own toast that it was not wired up. There is no invitation model and no
 * merchant-active flag for either to write to, so both are gone rather than
 * backed by something invented. The slug and the currency are shown as facts
 * for the same reason — the slug is in the discovery manifest a buying agent
 * may have already cached, and the currency is stamped on every order ever
 * placed, so neither is a field an operator should be able to type into.
 */

function Section({
  children,
  first,
  title,
}: {
  children: ReactNode;
  first?: boolean;
  title: string;
}) {
  return (
    <section className={first ? "" : "mt-12 border-hairline border-t pt-12"}>
      <Label>{title}</Label>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A fact about the store, shown rather than offered for editing. */
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-2 font-mono text-[15px] text-smoke tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Field({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        className="t-body mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-bone outline-none transition-colors duration-micro focus:border-bone"
        defaultValue={defaultValue}
        id={id}
        name={name}
      />
    </div>
  );
}

function StoreAccountScreen({ settings }: { settings: StoreSettings }) {
  const rename = useAction(renameStoreAction, {
    successMessage: "Store renamed.",
  });

  const onRename = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      rename.run(
        String(new FormData(event.currentTarget).get("name") ?? "")
      );
    },
    [rename]
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <h1 className="font-display font-semibold text-[32px] text-bone leading-none tracking-[-0.02em]">
        Account
      </h1>

      <div className="mt-14 max-w-[640px]">
        <Section first title="Store details">
          <form className="grid gap-5" onSubmit={onRename}>
            <Field defaultValue={settings.name} label="Name" name="name" />
            <Reading label="Slug" value={settings.slug} />
            <Reading label="Currency" value={settings.currency} />
            <div>
              <Pill disabled={rename.pending} size="sm" type="submit">
                {rename.pending ? "Saving…" : "Save name"}
              </Pill>
            </div>
          </form>
        </Section>

        <Section title="Payment">
          <RazorpayConnect
            isOwner={settings.isOwner}
            merchantId={settings.merchantId}
            ownerEmail={settings.ownerEmail}
            razorpay={settings.razorpay}
          />
        </Section>

        <Section title="Team">
          <div className="border-hairline border-t">
            {settings.team.map((member) => (
              <div
                className="flex flex-wrap items-center justify-between gap-5 border-hairline border-b py-4"
                key={member.id}
              >
                <div className="min-w-0">
                  <p className="t-body truncate text-bone">
                    {member.name}
                  </p>
                  <p className="t-body-sm mt-0.5 truncate text-smoke">
                    {member.email}
                  </p>
                </div>
                <span className="t-body-sm text-smoke">{member.role}</span>
              </div>
            ))}
          </div>

          <p className="t-body mt-6 max-w-[46ch] text-smoke leading-relaxed">
            One account owns a store. There is no invitation flow yet, so this
            is the list rather than a place to change it.
          </p>
        </Section>
      </div>

    </div>
  );
}

export { StoreAccountScreen };
