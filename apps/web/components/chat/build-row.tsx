"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useId } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { BuildSlotRow } from "@/lib/assistant/build";
import { partFor } from "@/lib/assistant/build";

/**
 * One slot, in two lanes.
 *
 * The row's height is fixed by the taller of its two states, so a swap
 * crossfades the parts in place and nothing below it moves. Animating the
 * height instead would make the whole sheet breathe every time somebody
 * changes their mind.
 */

/**
 * Fixed to the taller of the two variants above the stacking breakpoint, so a
 * swap — which empties the right lane and adds a Revert to the left — cannot
 * change the row's height. Below `lg` the lanes stack and the height has to be
 * free, or long part names would be clipped.
 */
const ROW_HEIGHT = "min-h-[104px] lg:h-[112px]";

interface BuildRowProps {
  entry: BuildSlotRow;
  onRevert: (slug: string) => void;
  onSwap: (slug: string) => void;
  onToggle: (slug: string) => void;
}

function BuildRow({ entry, onRevert, onSwap, onToggle }: BuildRowProps) {
  const checkboxId = useId();
  const part = partFor(entry);

  const toggle = useCallback(
    () => onToggle(entry.slug),
    [entry.slug, onToggle]
  );
  const swap = useCallback(() => onSwap(entry.slug), [entry.slug, onSwap]);
  const revert = useCallback(
    () => onRevert(entry.slug),
    [entry.slug, onRevert]
  );

  return (
    <div
      className={cn(
        "grid items-center gap-6 border-hairline border-b py-5",
        "grid-cols-1 lg:grid-cols-[62%_1fr]",
        ROW_HEIGHT
      )}
    >
      <div className="flex items-center gap-4 lg:border-hairline lg:border-r lg:pr-6">
        <input
          checked={entry.selected}
          className="peer sr-only"
          id={checkboxId}
          onChange={toggle}
          type="checkbox"
        />
        <label
          className={cn(
            "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border transition-colors duration-micro",
            entry.selected
              ? "border-bone"
              : "border-hairline hover:border-smoke",
            "peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-bone peer-focus-visible:outline-offset-[3px]"
          )}
          htmlFor={checkboxId}
        >
          {entry.selected ? (
            <Check
              aria-hidden
              className="check-in size-3.5 text-bone"
              strokeWidth={2.5}
            />
          ) : null}
        </label>

        <ImageGround className="size-14 shrink-0 rounded-[12px] p-2">
          <ProductRender alt="" category={part.category} />
        </ImageGround>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Label>{entry.slot}</Label>
            {entry.swapped ? (
              <>
                <Label className="text-verdant">Upgraded</Label>
                <Pill
                  className="h-auto py-0"
                  onClick={revert}
                  size="sm"
                  variant="text"
                >
                  Revert
                </Pill>
              </>
            ) : null}
          </div>
          <p className="t-body mt-1 truncate text-bone">{part.name}</p>
          <p className="t-num-xs mt-0.5 truncate text-smoke">
            {part.keySpecs
              .slice(0, 2)
              .map((spec) => spec.value)
              .join(" · ")}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <CountUp
            className={cn(
              "t-body",
              entry.selected ? "text-bone" : "text-smoke"
            )}
            format={formatPaise}
            value={part.pricePaise}
          />
        </div>
      </div>

      {/* Empty when there is nothing measurable to offer, and that is the
          default — no placeholder, no "no upgrade available". */}
      {entry.upgrade && !entry.swapped ? (
        <div className="flex items-center gap-4">
          <ImageGround className="size-11 shrink-0 rounded-[12px] p-2">
            <ProductRender alt="" category={entry.upgrade.product.category} />
          </ImageGround>

          <div className="min-w-0 flex-1">
            <Label>Upgrade</Label>
            <p className="t-body-sm mt-1 truncate text-bone">
              {entry.upgrade.product.name}
            </p>
            <p className="t-body-sm mt-0.5 truncate text-smoke">
              {entry.upgrade.reason}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="t-num-xs text-lacquer">
              +{formatPaise(entry.upgrade.deltaPaise)}
            </p>
            <Pill className="mt-2" onClick={swap} size="sm" variant="ghost">
              Swap
            </Pill>
          </div>
        </div>
      ) : (
        /* A row that *had* an upgrade keeps the lane's space after the swap,
           so taking it cannot change the row's height. A row that never had
           one reserves nothing — absence is the default. */
        <div className={entry.upgrade ? "min-h-[68px]" : undefined} />
      )}
    </div>
  );
}

export { BuildRow };
