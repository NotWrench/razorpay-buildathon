"use client";

import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SlotPicker } from "@/components/build/slot-picker";
import { ProductRender } from "@/components/common/product-render";
import { PillLink } from "@/components/common/pill-link";
import { useAction } from "@/hooks/use-action";
import { removeBuildPartAction, setBuildPartAction } from "@/lib/actions/build";
import type { CompatibilityReport, ProductSummary } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * The builder.
 *
 * Everything underneath this screen already existed and had no caller: the
 * eleven deterministic rules in `packages/commerce`, the four server actions
 * in `lib/actions/build.ts`, and the read side in `lib/data/compatibility.ts`.
 * Three links in the app pointed at a `/build` route that was never written.
 * This is that route; it computes nothing of its own.
 *
 * The shape is slot → selection → verdict → price, in that reading order,
 * because that is the order the decision is actually made in. The rail holds
 * the running total and the one verdict that matters, and never scrolls away.
 */

interface Slot {
  /** Null for a slot nothing has been chosen for yet. */
  category: CategorySlug;
  maxPerBuild: number | null;
  name: string;
  parts: ProductSummary[];
  required: boolean;
}

interface BuildScreenProps {
  buildId: string | null;
  report: CompatibilityReport | null;
  slots: Slot[];
  slug: string;
  totalPaise: number;
}

function SlotRow({
  onOpen,
  onRemove,
  pending,
  slot,
}: {
  onOpen: (slot: Slot) => void;
  onRemove: (productId: string) => void;
  pending: boolean;
  slot: Slot;
}) {
  const open = useCallback(() => onOpen(slot), [onOpen, slot]);
  const full =
    slot.maxPerBuild !== null && slot.parts.length >= slot.maxPerBuild;

  return (
   <div className="py-6">
      <div className="flex items-baseline justify-between gap-6">
        <Label>{slot.name}</Label>
        {slot.required && slot.parts.length === 0 ? (
          <span className="t-body-sm text-smoke">Required</span>
        ) : null}
      </div>

      {slot.parts.length === 0 ? (
        <button
          className="mt-4 flex w-full items-center gap-5 rounded-[20px] border border-hairline border-dashed px-5 py-4 text-left transition-colors duration-micro hover:border-smoke"
          onClick={open}
          type="button"
        >
          <span className="t-body flex-1 text-smoke">
            Choose {slot.name.toLowerCase()}
          </span>
          <span className="t-body-sm text-bone">Browse →</span>
        </button>
      ) : (
        <ul className="mt-4 space-y-3">
          {slot.parts.map((part) => (
            <li
              className="flex items-center gap-5 surface-card rounded-[20px] border border-hairline bg-panel p-4"
              key={part.id}
            >
              <ImageGround className="size-16 shrink-0 p-2">
                <ProductRender
                  alt={part.name}
                  category={part.category}
                  sizes="64px"
                  src={part.imageUrl || undefined}
                />
              </ImageGround>

              <div className="min-w-0 flex-1">
                <p className="t-body truncate font-medium text-bone">
                  {part.name}
                </p>
                <p className="t-body-sm mt-1 truncate text-smoke">
                  {part.brand}
                </p>
              </div>

              <span className="t-num-sm shrink-0 text-bone">
                {formatPaise(part.pricePaise)}
              </span>

              <Pill
                aria-label={`Remove ${part.name}`}
                disabled={pending}
                onClick={() => onRemove(part.id)}
                size="sm"
                variant="text"
              >
                Remove
              </Pill>
            </li>
          ))}

          {full ? null : (
            <li>
              <Pill
                className="w-full justify-center"
                onClick={open}
                size="sm"
                variant="ghost"
              >
                Add another
              </Pill>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function BuildScreen({
  buildId,
  report,
  slots,
  slug,
  totalPaise,
}: BuildScreenProps) {
  const router = useRouter();
  const [picking, setPicking] = useState<Slot | null>(null);

  const refresh = useCallback(() => {
    setPicking(null);
    router.refresh();
  }, [router]);

  const set = useAction(setBuildPartAction, { onSuccess: refresh });
  const remove = useAction(removeBuildPartAction, { onSuccess: refresh });
  const pending = set.pending || remove.pending;

  const onChoose = useCallback(
    (productId: string) =>
      set.run({ buildId: buildId ?? undefined, productId, slug }),
    [buildId, set, slug]
  );

  const onRemove = useCallback(
    (productId: string) => {
      if (buildId) {
        remove.run({ buildId, productId, slug });
      }
    },
    [buildId, remove, slug]
  );

  const chosen = slots.flatMap((slot) => slot.parts);
  const missing = slots.filter(
    (slot) => slot.required && slot.parts.length === 0
  );

  /*
   * Checkout is offered once nothing is blocking and every required slot is
   * filled. `validateBuildAction` re-runs the engine server-side before the
   * money path anyway; this only decides whether to offer the button.
   */
  const blocked = report?.overall === "incompatible" || missing.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16 2xl:px-16">
      <header className="max-w-[52ch]">
        <Label>Custom build</Label>
        <h1 className="t-display-lg mt-4 text-bone">Build it yourself</h1>
        <p className="t-body-lg mt-5 text-smoke">
          Choose a part for each slot. Every change is checked against the
          others — socket, memory, clearance, power — and anything that will
          not work is named before you pay for it.
        </p>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          {slots.map((slot) => (
            <SlotRow
              key={slot.category}
              onOpen={setPicking}
              onRemove={onRemove}
              pending={pending}
              slot={slot}
            />
          ))}
        </div>

        <aside className="surface-card rounded-[20px] bg-panel p-7 lg:sticky lg:top-[120px]">
          <Label>Your build</Label>

          <div className="mt-5 flex items-baseline justify-between gap-6">
            <span className="t-body text-smoke">
              {chosen.length} {chosen.length === 1 ? "part" : "parts"}
            </span>
            <CountUp
              className="t-num-lg text-bone"
              format={formatPaise}
              value={totalPaise}
            />
          </div>

          {report ? (
   <div className="mt-6 space-y-2 pt-6">
              {report.checks.length === 0 ? (
                <StatusLine
                  message="Nothing conflicts so far."
                  state="compatible"
                />
              ) : (
                report.checks.map((check) => (
                  <StatusLine
                    key={check.label}
                    message={check.message}
                    state={check.state}
                  />
                ))
              )}

              {report.estimatedWattage ? (
                <p className="t-num-xs pt-2 text-smoke">
                  {report.estimatedWattage} W estimated
                  {report.psuRatedWattage
                    ? ` · ${report.psuRatedWattage} W recommended`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : (
   <p className="t-body-sm mt-6 pt-6 text-smoke">
              Pick a part and the checks start running.
            </p>
          )}

          {missing.length > 0 ? (
            <p className="t-body-sm mt-6 text-smoke">
              Still needed: {missing.map((slot) => slot.name).join(", ")}.
            </p>
          ) : null}

          <PillLink
            aria-disabled={blocked}
            className={cn(
              "mt-7 w-full justify-center",
              blocked && "pointer-events-none opacity-40"
            )}
            href={shellRoutes.checkoutWith(chosen.map((part) => part.id))}
            tabIndex={blocked ? -1 : undefined}
          >
            Checkout
          </PillLink>

          <p className="t-body-sm mt-4 text-smoke">
            Prices include GST. Assembly and testing are included on any build
            of six parts or more.
          </p>
        </aside>
      </div>

      {picking ? (
        <SlotPicker
          category={picking.category}
          hasBuild={Boolean(buildId)}
          onChoose={onChoose}
          onOpenChange={(open) => !open && setPicking(null)}
          open={Boolean(picking)}
          pending={pending}
          slotName={picking.name}
        />
      ) : null}
    </div>
  );
}

export type { Slot };
export { BuildScreen };
