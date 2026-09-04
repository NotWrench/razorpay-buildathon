"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import type { ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { TypedConfirmDialog } from "@/components/manager/manager-dialogs";
import type { StoreSettings } from "@/lib/data/types";

/**
 * The store's own settings. No cards, no analysis, no numbers worth counting.
 *
 * The Razorpay key is masked and stays masked: a screen that prints a live key
 * in full is one screenshot away from being an incident, and there is nothing
 * an operator does here that needs the whole string.
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

function Field({
  defaultValue,
  label,
  mono,
}: {
  defaultValue: string;
  label: string;
  mono?: boolean;
}) {
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        className={
          mono
            ? "t-num-sm mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-bone outline-none transition-colors duration-micro focus:border-bone"
            : "t-body mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-bone outline-none transition-colors duration-micro focus:border-bone"
        }
        defaultValue={defaultValue}
        id={id}
      />
    </div>
  );
}

function StoreAccountScreen({ settings }: { settings: StoreSettings }) {
  const [closing, setClosing] = useState(false);

  const onUpdateKey = useCallback(
    () => toast("Key rotation happens in the Razorpay dashboard."),
    []
  );

  const onInvite = useCallback(
    () => toast("Invitation drafted. It has not been sent."),
    []
  );

  const onOpenClose = useCallback(() => setClosing(true), []);

  const onCloseStore = useCallback(
    () => toast("Nothing was closed — this screen is not wired up yet."),
    []
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <h1 className="t-display-md text-bone leading-none">
        Account
      </h1>

      <div className="mt-14 max-w-[640px]">
        <Section first title="Store details">
          <div className="grid gap-5">
            <Field defaultValue={settings.name} label="Name" />
            <Field defaultValue={settings.slug} label="Slug" mono />
            <Field defaultValue={settings.currency} label="Currency" mono />
          </div>
        </Section>

        <Section title="Payment">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Label>Razorpay key id</Label>
              <p className="t-num-sm mt-2 text-bone">
                {settings.razorpayKeyId}
              </p>
            </div>
            <Pill onClick={onUpdateKey} size="sm" variant="ghost">
              Update
            </Pill>
          </div>
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

          <div className="mt-6">
            <Pill onClick={onInvite} size="sm" variant="ghost">
              Invite
            </Pill>
          </div>
        </Section>

        <Section title="Leaving">
          <p className="t-body max-w-[46ch] text-smoke leading-relaxed">
            Closing the store takes the catalogue offline and stops new orders.
            Existing orders stay readable.
          </p>
          <div className="mt-5">
            <Pill
              className="text-lacquer hover:text-ember"
              onClick={onOpenClose}
              size="sm"
              variant="text"
            >
              Close store
            </Pill>
          </div>
        </Section>
      </div>

      <TypedConfirmDialog
        body="The catalogue goes offline and no new orders can be placed. Existing orders stay readable."
        confirmLabel="Close store"
        onConfirm={onCloseStore}
        onOpenChange={setClosing}
        open={closing}
        title="Close this store"
        word="CLOSE"
      />
    </div>
  );
}

export { StoreAccountScreen };
