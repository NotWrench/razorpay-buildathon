"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef, useState } from "react";

/**
 * A two-handle price range, in rupees.
 *
 * Written rather than installed: a slider is two numbers, a track and a
 * pointer listener, and a dependency for it would arrive with its own theme
 * to fight. Both handles are real buttons, so the keyboard gets arrow keys
 * for free and the range is operable without a pointer at all.
 *
 * **Draft now, commit on settle.** `onCommit` reaches the shelf as a soft
 * navigation and a catalogue query, so it used to fire on every pointer tick
 * of a drag and on every keystroke in the two fields — dozens of round trips
 * a second, and a field you could not actually type in, because 50000 was
 * clamped to the floor the moment the first digit landed. The handles and the
 * fields now move against local state and commit when the interaction ends:
 * pointer up, key up, blur, or Enter.
 */

interface PriceRangeProps {
  ceiling: number;
  floor: number;
  onCommit: (range: { max: number; min: number }) => void;
  value: { max: number; min: number };
}

interface Range {
  max: number;
  min: number;
}

type Handle = "min" | "max";

const STEP = 500;

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}

function rupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** One handle moved, with the other held and the two kept a step apart. */
function moved(
  current: Range,
  handle: Handle,
  next: number,
  floor: number,
  ceiling: number
): Range {
  return handle === "min"
    ? { max: current.max, min: clamp(next, floor, current.max - STEP) }
    : { max: clamp(next, current.min + STEP, ceiling), min: current.min };
}

function PriceRange({ ceiling, floor, onCommit, value }: PriceRangeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);

  const [draft, setDraft] = useState<Range>(value);
  const [text, setText] = useState({
    max: String(value.max),
    min: String(value.min),
  });

  /*
   * The committed range is the prop, so when the URL moves underneath us — a
   * cleared filter, a back button — the draft has to follow. Adjusting during
   * render rather than in an effect keeps the two from disagreeing for a frame.
   */
  const [seen, setSeen] = useState(value);

  if (seen.min !== value.min || seen.max !== value.max) {
    setSeen(value);
    setDraft(value);
    setText({ max: String(value.max), min: String(value.min) });
  }

  /* The latest draft, readable from listeners bound before it existed. */
  const draftRef = useRef(draft);

  const apply = useCallback((next: Range) => {
    draftRef.current = next;
    setDraft(next);
    setText({ max: String(next.max), min: String(next.min) });
  }, []);

  const commit = useCallback(() => onCommit(draftRef.current), [onCommit]);

  const span = Math.max(ceiling - floor, 1);
  const percent = (amount: number) => ((amount - floor) / span) * 100;

  const positionToValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;

      // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
      if (!track) {
        return floor;
      }

      const box = track.getBoundingClientRect();
      const ratio = clamp((clientX - box.left) / box.width, 0, 1);

      return Math.round((floor + ratio * span) / STEP) * STEP;
    },
    [floor, span]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      setDragging((handle) => {
        if (handle) {
          const next = positionToValue(event.clientX);
          const { current } = draftRef;

          apply(moved(current, handle, next, floor, ceiling));
        }

        return handle;
      });
    },
    [apply, ceiling, floor, positionToValue]
  );

  const stopDrag = useCallback(() => {
    setDragging(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
    commit();
  }, [commit, onPointerMove]);

  const startDrag = useCallback(
    (handle: Handle) => (event: ReactPointerEvent) => {
      event.preventDefault();
      setDragging(handle);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
    },
    [onPointerMove, stopDrag]
  );

  /*
   * Arrows move the draft and the commit waits for key up, so holding an
   * arrow scrubs the handle across the track and asks the server once.
   */
  const onHandleKeyDown = useCallback(
    (handle: Handle) => (event: ReactKeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();

      const step = event.key === "ArrowRight" ? STEP : -STEP;
      const { current } = draftRef;

      apply(
        moved(
          current,
          handle,
          (handle === "min" ? current.min : current.max) + step,
          floor,
          ceiling
        )
      );
    },
    [apply, ceiling, floor]
  );

  const onHandleKeyUp = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        commit();
      }
    },
    [commit]
  );

  /* Typing is unclamped: a half-typed number is not yet a wrong number. */
  const onFieldChange = useCallback(
    (handle: Handle) => (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/[^0-9]/g, "");

      setText((current) => ({ ...current, [handle]: digits }));
    },
    []
  );

  const settleField = useCallback(
    (handle: Handle) => () => {
      const parsed = Number.parseInt(text[handle], 10);
      const { current } = draftRef;
      const next = Number.isFinite(parsed)
        ? moved(current, handle, parsed, floor, ceiling)
        : current;

      apply(next);
      onCommit(next);
    },
    [apply, ceiling, floor, onCommit, text]
  );

  const onFieldKeyDown = useCallback(
    (handle: Handle) => (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        settleField(handle)();
      }
    },
    [settleField]
  );

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>Price</Label>
        <span className="t-num-xs text-smoke">
          {rupees(draft.min)} – {rupees(draft.max)}
        </span>
      </div>

      <div className="relative mt-6 h-6" ref={trackRef}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline"
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-px -translate-y-1/2 bg-smoke"
          style={{
            left: `${percent(draft.min)}%`,
            width: `${percent(draft.max) - percent(draft.min)}%`,
          }}
        />
        <button
          aria-label="Minimum price"
          aria-valuemax={draft.max - STEP}
          aria-valuemin={floor}
          aria-valuenow={draft.min}
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-smoke bg-panel transition-transform duration-micro",
            dragging === "min" && "scale-110"
          )}
          onKeyDown={onHandleKeyDown("min")}
          onKeyUp={onHandleKeyUp}
          onPointerDown={startDrag("min")}
          role="slider"
          style={{ left: `${percent(draft.min)}%` }}
          type="button"
        />
        <button
          aria-label="Maximum price"
          aria-valuemax={ceiling}
          aria-valuemin={draft.min + STEP}
          aria-valuenow={draft.max}
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-smoke bg-panel transition-transform duration-micro",
            dragging === "max" && "scale-110"
          )}
          onKeyDown={onHandleKeyDown("max")}
          onKeyUp={onHandleKeyUp}
          onPointerDown={startDrag("max")}
          role="slider"
          style={{ left: `${percent(draft.max)}%` }}
          type="button"
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <input
          aria-label="Minimum price in rupees"
          className="t-num-xs h-10 w-full rounded-full border border-hairline bg-transparent px-4 text-bone focus:border-smoke focus:outline-none"
          inputMode="numeric"
          onBlur={settleField("min")}
          onChange={onFieldChange("min")}
          onKeyDown={onFieldKeyDown("min")}
          value={text.min}
        />
        <span aria-hidden className="text-smoke">
          –
        </span>
        <input
          aria-label="Maximum price in rupees"
          className="t-num-xs h-10 w-full rounded-full border border-hairline bg-transparent px-4 text-bone focus:border-smoke focus:outline-none"
          inputMode="numeric"
          onBlur={settleField("max")}
          onChange={onFieldChange("max")}
          onKeyDown={onFieldKeyDown("max")}
          value={text.max}
        />
      </div>
    </div>
  );
}

export { PriceRange };
