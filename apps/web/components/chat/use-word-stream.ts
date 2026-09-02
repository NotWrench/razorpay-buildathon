"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One clock for streamed answers, shared by the dock and the full assistant.
 *
 * It hands back how many words of the current answer are visible, and a `stop`
 * that finishes the answer immediately rather than abandoning it half-said —
 * a stopped stream should leave a readable message, not a fragment.
 */

/** Roughly the cadence of someone thinking, not a typewriter. */
export const WORD_MS = 90;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface WordStream {
  /** Words revealed so far of the answer currently streaming. */
  shown: number;
  start: (words: number) => void;
  stop: () => void;
  streaming: boolean;
}

export function useWordStream(): WordStream {
  const [shown, setShown] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const total = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: the timer only exists while streaming
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clear();
    setShown(total.current);
    setStreaming(false);
  }, [clear]);

  const start = useCallback(
    (words: number) => {
      clear();
      total.current = words;

      /* Reduced motion gets the finished answer, not a faster reveal. */
      if (prefersReducedMotion()) {
        setShown(words);
        setStreaming(false);

        return;
      }

      setShown(0);
      setStreaming(true);

      timer.current = setInterval(() => {
        setShown((current) => {
          if (current + 1 >= words) {
            clear();
            setStreaming(false);

            return words;
          }

          return current + 1;
        });
      }, WORD_MS);
    },
    [clear]
  );

  useEffect(() => clear, [clear]);

  return { shown, start, stop, streaming };
}
