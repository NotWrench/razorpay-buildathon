"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { CountUp } from "@workspace/ui/components/motion/count-up";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import { BuildRow } from "@/components/chat/build-row";
import { PillLink } from "@/components/common/pill-link";
import { ProductRender } from "@/components/common/product-render";
import type { BuildSlotRow, BuildVerdict } from "@/lib/assistant/build";
import { partFor } from "@/lib/assistant/build";
import { shellRoutes } from "@/lib/routes";

/**
 * The build, in two states, as one object.
 *
 * Sheet and card are the same element — the container is measured before the
 * state changes and after, and the difference is inverted onto its transform
 * and released. It reads as the card *becoming* the sheet. Two separately
 * mounted components crossfading would be much less code and would look
 * exactly like what it is.
 */

/** Long enough to read as one movement rather than a jump. */
const MORPH_MS = 520;

/** Rows arrive once the container is most of the way there. */
const ROWS_DELAY_MS = 310;

interface BuildSurfaceProps {
  basis: string;
  docked: boolean;
  onExpand: () => void;
  onRevert: (slug: string) => void;
  onSwap: (slug: string) => void;
  onToggle: (slug: string) => void;
  rows: BuildSlotRow[];
  verdict: BuildVerdict;
}

function BuildSurface({
  basis,
  docked,
  onExpand,
  onRevert,
  onSwap,
  onToggle,
  rows,
  verdict,
}: BuildSurfaceProps) {
  const container = useRef<HTMLDivElement>(null);
  const previous = useRef<DOMRect | null>(null);
  const wasDocked = useRef(docked);

  /*
   * FLIP. The rect from before the state change is inverted onto the new one
   * and released — the browser lays out once, and only `transform` animates.
   */
  useLayoutEffect(() => {
    const node = container.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node) {
      return;
    }

    const first = previous.current;
    const changed = wasDocked.current !== docked;

    wasDocked.current = docked;
    previous.current = node.getBoundingClientRect();

    if (
      // biome-ignore lint/suspicious/noUnnecessaryConditions: the rect is written by the previous run of this effect, not this one
      !(first && changed) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const last = node.getBoundingClientRect();
    const scaleX = first.width / last.width;
    const scaleY = first.height / last.height;

    node.style.transformOrigin = "top left";
    node.style.transition = "none";
    node.style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${scaleX}, ${scaleY})`;

    /*
     * Read the layout back to flush the inverted frame, then release in the
     * same tick. `requestAnimationFrame` is the usual way to do this and it is
     * wrong here: it does not fire while the tab is not rendering, which
     * strands the sheet at 22% of its size until something else wakes it.
     */
    const flushed = node.getBoundingClientRect();

    if (flushed.width > 0) {
      /*
       * `will-change` for the length of the morph and not a moment longer —
       * left on permanently it holds a layer for an element that is static
       * 99% of the time, which is how a hint becomes a memory leak.
       */
      node.style.willChange = "transform";
      node.style.transition = `transform ${MORPH_MS}ms cubic-bezier(.22,1,.36,1)`;
      node.style.transform = "";

      const settle = () => {
        node.style.willChange = "";
        node.removeEventListener("transitionend", settle);
      };

      node.addEventListener("transitionend", settle);
    }
  }, [docked]);

  const selected = rows.filter((entry) => entry.selected);

  if (docked) {
    return (
      <div
        className="surface-float fixed z-40 rounded-[20px] border border-hairline bg-panel p-5 max-lg:right-4 max-lg:bottom-28 max-lg:w-[196px] lg:top-1/2 lg:right-6 lg:w-[220px] lg:-translate-y-1/2"
        ref={container}
      >
        <Label>Your build</Label>

        {/* Fanned, not stacked — a neat pile reads as one object, a slight
            fan says there are several. */}
        <div className="mt-4 flex h-14 items-center justify-center max-lg:hidden">
          {selected.slice(0, 4).map((entry, index) => (
            <ImageGround
              className="-ml-3 size-12 shrink-0 rounded-[12px] p-1.5 first:ml-0"
              key={entry.slug}
              style={{
                rotate: `${(index - 1.5) * 5}deg`,
                zIndex: 4 - index,
              }}
            >
              <ProductRender
                alt=""
                category={partFor(entry).category}
                sizes="48px"
                src={partFor(entry).imageUrl || undefined}
              />
            </ImageGround>
          ))}
        </div>

        <p className="t-num-xs mt-4 text-smoke">{selected.length} parts</p>
        <p className="t-num-sm mt-1 text-bone">
          {formatPaise(verdict.totalPaise)}
        </p>

        <StatusLine
          className="mt-3"
          message={
            verdict.state === "compatible" ? "All compatible" : verdict.message
          }
          state={verdict.state}
        />

        <Pill
          className="mt-4 w-full justify-center"
          onClick={onExpand}
          size="sm"
          variant="ghost"
        >
          Review
        </Pill>
      </div>
    );
  }

  /*
   * The thread reads at 760px; the sheet needs 1000 for two lanes, so it
   * breaks out of the column on a transform rather than widening the column
   * and re-wrapping every message above it.
   */
  return (
    <div className="relative left-1/2 w-[min(1000px,calc(100vw-3rem))] -translate-x-1/2">
      <div
        className="surface-card overflow-hidden rounded-[20px] border border-hairline bg-panel/40"
        ref={container}
      >
        <div className="flex items-baseline justify-between gap-6 border-hairline border-b px-6 py-4">
          <Label>Your build</Label>
          <span className="t-num-xs text-smoke">{basis}</span>
        </div>

        <div className="px-6">
          {rows.map((entry, index) => (
            <div
              className="build-row"
              key={entry.slug}
              style={{ animationDelay: `${ROWS_DELAY_MS + index * 40}ms` }}
            >
              <BuildRow
                entry={entry}
                onRevert={onRevert}
                onSwap={onSwap}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 border-hairline border-t bg-panel px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <span className="t-num-xs text-smoke">
              {selected.length} of {rows.length} selected
            </span>

            {/* Keyed on the verdict so a re-computed answer flashes once. */}
            <div aria-live="polite" className="min-w-0 flex-1">
              <StatusLine
                className="status-flash"
                key={verdict.message}
                message={verdict.message}
                state={verdict.state}
              />
            </div>

            <div className="text-right">
              <CountUp
                className="t-num-md text-bone"
                format={wholeRupees}
                value={verdict.totalPaise}
              />
              {verdict.upgradePaise > 0 ? (
                <p className="t-num-xs mt-1 text-ember">
                  +{formatPaise(verdict.upgradePaise)} upgrades
                </p>
              ) : null}
            </div>

            <PillLink
              aria-disabled={!verdict.canContinue}
              className={cn(
                !verdict.canContinue && "pointer-events-none opacity-40"
              )}
              href={shellRoutes.checkoutWith(
                selected.map((entry) => partFor(entry).id)
              )}
            >
              Continue to payment
            </PillLink>
          </div>
        </div>
      </div>

      {/* Beneath the sheet, never inside a modal: a missing required slot is
            something to say, not something to stop somebody with. */}
      {verdict.requirement ? (
        <StatusLine
          className="mt-4"
          message={verdict.requirement}
          state="needs_verification"
        />
      ) : null}
    </div>
  );
}

/** Money counts in whole rupees; paise frames read as a broken price. */
const wholeRupees = (paise: number) =>
  formatPaise(Math.round(paise / 100) * 100);

export { BuildSurface };
