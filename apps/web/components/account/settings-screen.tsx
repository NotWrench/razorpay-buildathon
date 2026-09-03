"use client";

import { Menu } from "@base-ui/react/menu";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/account/delete-dialog";
import { ThemeSwatches } from "@/components/account/theme-swatches";
import { ToggleRow } from "@/components/account/toggle-row";
import type { Account } from "@/lib/mock/types";

/**
 * Settings, with no cards at all.
 *
 * Sections are separated by a full-width hairline and 96px of air. A card
 * around each group would turn a quiet list of preferences into five competing
 * panels, and there is nothing here that needs to be lifted off the page.
 *
 * There is no solid pill on this screen. The destructive action is lacquer
 * text — red as a fill means "press this", and "delete my account" is not
 * something the page should be inviting.
 */

const MODES = ["Build", "Compare", "Recommend", "About", "Orders"] as const;

interface SettingsState {
  autoOpen: boolean;
  defaultMode: string;
  notifyDispatch: boolean;
  notifyOffers: boolean;
  notifyOrders: boolean;
  notifyRestock: boolean;
  reduceAnimations: boolean;
  remember: boolean;
  theme: string;
}

const INITIAL: SettingsState = {
  autoOpen: true,
  defaultMode: "Build",
  notifyDispatch: true,
  notifyOffers: false,
  notifyOrders: true,
  notifyRestock: false,
  reduceAnimations: false,
  remember: true,
  theme: "black-red",
};

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

function ModeItem({
  mode,
  onSelect,
}: {
  mode: string;
  onSelect: (mode: string) => void;
}) {
  const choose = useCallback(() => onSelect(mode), [mode, onSelect]);

  return (
    <Menu.Item
      className="cursor-default rounded-[16px] px-4 py-2.5 text-[15px] text-bone outline-none transition-colors duration-[180ms] data-highlighted:bg-riser"
      onClick={choose}
    >
      {mode}
    </Menu.Item>
  );
}

function PillField({
  defaultValue,
  label,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        className="mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-[15px] text-bone outline-none transition-colors duration-[180ms] focus:border-bone"
        defaultValue={defaultValue}
        type={type}
      />
    </div>
  );
}

function SettingsScreen({ account }: { account: Account }) {
  const [settings, setSettings] = useState(INITIAL);

  /* Optimistic: the switch moves, the toast confirms, nothing waits. */
  const save = useCallback((message: string) => {
    toast(message);
  }, []);

  const onToggle = useCallback(
    (name: string, checked: boolean) => {
      setSettings((current) => ({ ...current, [name]: checked }));
      save("Saved.");
    },
    [save]
  );

  const onTheme = useCallback(
    (theme: string) => {
      setSettings((current) => ({ ...current, theme }));
      save(
        theme === "black-red"
          ? "Saved."
          : "Saved. Only Black + Red is built so far."
      );
    },
    [save]
  );

  const onMode = useCallback(
    (mode: string) => {
      setSettings((current) => ({ ...current, defaultMode: mode }));
      save(`The assistant will open in ${mode}.`);
    },
    [save]
  );

  const onClearMemory = useCallback(
    () => save("Assistant memory cleared."),
    [save]
  );

  const onDelete = useCallback(
    () => save("Nothing was deleted — accounts are not wired up yet."),
    [save]
  );

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display font-semibold text-[28px] text-bone leading-none tracking-[-0.02em]">
        Settings
      </h1>

      <div className="mt-16">
        <Section first title="Account">
          <div className="grid gap-5">
            <PillField defaultValue={account.name} label="Name" />
            <PillField
              defaultValue={account.email}
              label="Email"
              type="email"
            />
            <div>
              <Pill size="sm" variant="ghost">
                Change password
              </Pill>
            </div>
          </div>
        </Section>

        <Section title="Appearance">
          <p className="text-[15px] text-bone">Theme</p>
          <ThemeSwatches onChange={onTheme} value={settings.theme} />

          <div className="mt-8">
            <ToggleRow
              checked={settings.reduceAnimations}
              label="Reduce animations"
              name="reduceAnimations"
              onChange={onToggle}
            />
          </div>
        </Section>

        <Section title="Assistant">
          <div className="flex items-center justify-between gap-8 py-3.5">
            <span className="text-[15px] text-bone">Default mode</span>

            <Menu.Root>
              <Menu.Trigger
                className="flex items-center gap-2 text-[15px] text-smoke outline-none transition-colors duration-[180ms] hover:text-bone focus-visible:text-bone"
                render={<button type="button" />}
              >
                {settings.defaultMode}
                <ChevronDown aria-hidden className="size-4" />
              </Menu.Trigger>

              <Menu.Portal>
                <Menu.Positioner align="end" sideOffset={8}>
                  <Menu.Popup className="min-w-[180px] rounded-[20px] border border-hairline bg-panel p-1.5 shadow-float outline-none">
                    {MODES.map((mode) => (
                      <ModeItem key={mode} mode={mode} onSelect={onMode} />
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>

          <ToggleRow
            checked={settings.autoOpen}
            label="Open automatically on product pages"
            name="autoOpen"
            onChange={onToggle}
          />
          <ToggleRow
            checked={settings.remember}
            description="Budget, use case and platform only"
            label="Remember my preferences"
            name="remember"
            onChange={onToggle}
          />

          <div className="mt-5">
            <Pill
              className="text-lacquer hover:text-ember"
              onClick={onClearMemory}
              size="sm"
              variant="text"
            >
              Clear assistant memory
            </Pill>
          </div>
        </Section>

        <Section title="Notifications">
          <ToggleRow
            checked={settings.notifyOrders}
            label="Order updates"
            name="notifyOrders"
            onChange={onToggle}
          />
          <ToggleRow
            checked={settings.notifyDispatch}
            label="Dispatch and delivery"
            name="notifyDispatch"
            onChange={onToggle}
          />
          <ToggleRow
            checked={settings.notifyRestock}
            label="Back in stock"
            name="notifyRestock"
            onChange={onToggle}
          />
          <ToggleRow
            checked={settings.notifyOffers}
            label="Offers and price drops"
            name="notifyOffers"
            onChange={onToggle}
          />
        </Section>

        <Section title="Leaving">
          <p className="max-w-[46ch] text-[15px] text-smoke leading-relaxed">
            Deleting your account removes your orders, your saved builds and
            every conversation you have had with the assistant.
          </p>
          <div className="mt-5">
            <DeleteDialog onConfirm={onDelete} />
          </div>
        </Section>
      </div>
    </div>
  );
}

export { SettingsScreen };
