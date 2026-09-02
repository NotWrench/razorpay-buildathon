"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";

/**
 * A two-handle price range, in rupees.
 *
 * Written rather than installed: a slider is two numbers, a track and a
 * pointer listener, and a dependency for it would arrive with its own theme
 * to fight. Both handles are real buttons, so the keyboard gets arrow keys
 * for free and the range is operable without a pointer at all.
 */

interface PriceRangeProps {
  ceiling: number;
  floor: number;
  onCommit: (range: { max: number; min: number }) => void;
  value: { max: number; min: number };
}

const STEP = 500;

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}

function rupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function PriceRange({ ceiling, floor, onCommit, value }: PriceRangeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"min" | "max" | null>(null);
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
        if (!handle) {
          return handle;
        }

        const next = positionToValue(event.clientX);

        onCommit(
          handle === "min"
            ? { max: value.max, min: clamp(next, floor, value.max - STEP) }
            : { max: clamp(next, value.min + STEP, ceiling), min: value.min }
        );

        return handle;
      });
    },
    [ceiling, floor, onCommit, positionToValue, value.max, value.min]
  );

  const stopDrag = useCallback(() => {
    setDragging(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  const startDrag = useCallback(
    (handle: "min" | "max") => (event: ReactPointerEvent) => {
      event.preventDefault();
      setDragging(handle);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
    },
    [onPointerMove, stopDrag]
  );

  const onMinKey = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.key === "ArrowRight" ? STEP : -STEP;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        onCommit({
          max: value.max,
          min: clamp(value.min + step, floor, value.max - STEP),
        });
      }
    },
    [floor, onCommit, value.max, value.min]
  );

  const onMaxKey = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.key === "ArrowRight" ? STEP : -STEP;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        onCommit({
          max: clamp(value.max + step, value.min + STEP, ceiling),
          min: value.min,
        });
      }
    },
    [ceiling, onCommit, value.max, value.min]
  );

  const onMinInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = Number.parseInt(event.target.value.replace(/\D/g, ""), 10);

      onCommit({
        max: value.max,
        min: Number.isFinite(next)
          ? clamp(next, floor, value.max - STEP)
          : floor,
      });
    },
    [floor, onCommit, value.max]
  );

  const onMaxInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = Number.parseInt(event.target.value.replace(/\D/g, ""), 10);

      onCommit({
        max: Number.isFinite(next)
          ? clamp(next, value.min + STEP, ceiling)
          : ceiling,
        min: value.min,
      });
    },
    [ceiling, onCommit, value.min]
  );

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>Price</Label>
        <span className="font-mono text-[13px] text-smoke tabular-nums">
          {rupees(value.min)} – {rupees(value.max)}
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
            left: `${percent(value.min)}%`,
            width: `${percent(value.max) - percent(value.min)}%`,
          }}
        />
        <button
          aria-label="Minimum price"
          aria-valuemax={value.max - STEP}
          aria-valuemin={floor}
          aria-valuenow={value.min}
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-smoke bg-panel transition-transform duration-[180ms]",
            dragging === "min" && "scale-110"
          )}
          onKeyDown={onMinKey}
          onPointerDown={startDrag("min")}
          role="slider"
          style={{ left: `${percent(value.min)}%` }}
          type="button"
        />
        <button
          aria-label="Maximum price"
          aria-valuemax={ceiling}
          aria-valuemin={value.min + STEP}
          aria-valuenow={value.max}
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-smoke bg-panel transition-transform duration-[180ms]",
            dragging === "max" && "scale-110"
          )}
          onKeyDown={onMaxKey}
          onPointerDown={startDrag("max")}
          role="slider"
          style={{ left: `${percent(value.max)}%` }}
          type="button"
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <input
          aria-label="Minimum price in rupees"
          className="h-10 w-full rounded-full border border-hairline bg-transparent px-4 font-mono text-[13px] text-bone tabular-nums focus:border-smoke focus:outline-none"
          inputMode="numeric"
          onChange={onMinInput}
          value={value.min}
        />
        <span aria-hidden className="text-smoke">
          –
        </span>
        <input
          aria-label="Maximum price in rupees"
          className="h-10 w-full rounded-full border border-hairline bg-transparent px-4 font-mono text-[13px] text-bone tabular-nums focus:border-smoke focus:outline-none"
          inputMode="numeric"
          onChange={onMaxInput}
          value={value.max}
        />
      </div>
    </div>
  );
}

export { PriceRange };
