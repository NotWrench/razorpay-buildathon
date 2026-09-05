"use client";

import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The model's thinking, while it is thinking.
 *
 * The shopping agent reasons for far longer than it speaks — measured at 214
 * reasoning deltas against 27 of content on one ordinary question — and until
 * now every one of those was discarded at the provider boundary, so a turn
 * that took thirty seconds of real deliberation arrived as two sentences with
 * nothing behind them. That is what made the assistant read as unconsidered:
 * not that it was not thinking, but that the thinking was invisible.
 *
 * Showing it raw would be its own mistake. Four thousand characters of
 * half-formed reasoning above a three-line answer buries the answer, and the
 * buyer came here for the answer. So this does what a person does when they
 * work something out in front of you: it is legible while it happens, and it
 * gets out of the way once there is a conclusion to read.
 *
 * The trail is never the product. Nothing here is load-bearing — every claim
 * the buyer acts on is in the reply and in the tool cards beside it, and the
 * reasoning is corroboration you can open, not evidence you have to read.
 */

/** How much of the tail stays visible while the model is still working. */
const LIVE_HEIGHT = "max-h-[4.5rem]";

/** Below this, "thought for a second" is a more honest reading than a count. */
const BRIEF_MS = 1500;

function describeElapsed(ms: number | null): string {
  if (ms === null) {
    return "Thought about it";
  }

  if (ms < BRIEF_MS) {
    return "Thought for a second";
  }

  return `Thought for ${Math.round(ms / 1000)} seconds`;
}

export function ReasoningTrail({
  streaming,
  text,
}: {
  /** The part's own state, not the turn's — tools stream after this ends. */
  streaming: boolean;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  /*
   * Mount is the first reasoning delta: the part does not exist before the
   * model starts thinking, so there is nothing earlier to measure from.
   */
  const started = useRef(Date.now());
  const live = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming) {
      /* Frozen on the first settle. A re-render must not restart the clock. */
      setElapsed((current) => current ?? Date.now() - started.current);
    }
  }, [streaming]);

  /* The live view follows the tail, the way a console does. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: text is the render signal, not a value read here.
  useEffect(() => {
    const node = live.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [text]);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  if (!text.trim()) {
    return null;
  }

  if (streaming) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-[13px] text-smoke">
          <span aria-hidden className="stream-caret">
            ▍
          </span>
          Thinking
        </p>
        <div
          aria-live="polite"
          className={cn(
            LIVE_HEIGHT,
            "overflow-hidden whitespace-pre-wrap border-hairline border-l pl-3 text-[12px] text-smoke/70 leading-relaxed",
            /*
             * Faded at the top rather than clipped. A hard edge reads as text
             * that failed to load; a fade reads as more of it above, which is
             * what is actually true.
             */
            "[mask-image:linear-gradient(to_bottom,transparent,black_2rem)]"
          )}
          ref={live}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        aria-expanded={open}
        className="flex w-fit items-center gap-1.5 text-[13px] text-smoke transition-colors hover:text-bone"
        onClick={toggle}
        type="button"
      >
        <span
          aria-hidden
          className={cn(
            "inline-block transition-transform",
            open && "rotate-90"
          )}
        >
          ›
        </span>
        {describeElapsed(elapsed)}
      </button>

      {open ? (
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap border-hairline border-l pl-3 text-[12px] text-smoke/70 leading-relaxed">
          {text}
        </div>
      ) : null}
    </div>
  );
}
