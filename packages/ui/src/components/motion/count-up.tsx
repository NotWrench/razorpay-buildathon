"use client";

import { DUR, EASE } from "@workspace/ui/lib/motion";
import { cn } from "@workspace/ui/lib/utils";
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

interface CountUpProps {
  className?: string;
  format?: (value: number) => string;
  /** Where the count starts. Defaults to zero. */
  from?: number;
  value: number;
}

const defaultFormat = (value: number) =>
  Math.round(value).toLocaleString("en-IN");

/**
 * A number that arrives by counting.
 *
 * Two things keep it from being annoying: the settled value is rendered
 * invisibly underneath so the box never resizes mid-count, and screen readers
 * are given the final figure once instead of sixty intermediate ones.
 */
function CountUp({
  className,
  format = defaultFormat,
  from = 0,
  value,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);

  formatRef.current = format;

  useEffect(() => {
    const node = ref.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node || reduced) {
      return;
    }

    const controls = animate(from, value, {
      duration: DUR.standard,
      ease: EASE.out,
      onUpdate: (current) => {
        /*
         * Rounded before it reaches the formatter. Every number this design
         * counts is an integer — paise, watts, counts — and handing a
         * formatter 3_705_831.4 paise renders "₹37,058.31" for a frame, which
         * reads as a broken price rather than an animation.
         */
        node.textContent = formatRef.current(Math.round(current));
      },
    });

    return () => controls.stop();
  }, [from, reduced, value]);

  const settled = format(value);

  return (
    <span
      className={cn("relative inline-block font-mono tabular-nums", className)}
    >
      <span aria-hidden className="invisible">
        {settled}
      </span>
      <span aria-hidden className="absolute inset-0" ref={ref}>
        {settled}
      </span>
      <span className="sr-only">{settled}</span>
    </span>
  );
}

export { CountUp };
