"use client";

import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useState } from "react";

/**
 * The model's thinking, in the panel surfaces.
 *
 * Deliberately quieter than the full-page trail in `chat/reasoning-trail.tsx`.
 * The dock and the merchant panel are narrow columns beside the thing the
 * reader is actually working on, and a live-scrolling block of half-formed
 * reasoning there would take the column over — while the thread already says
 * "Thinking…" for as long as the turn is in flight, which is the part that
 * matters live. So this stays folded until asked for.
 *
 * It is corroboration, not evidence. Every figure the merchant acts on comes
 * from a tool card; this is where they look when they want to argue with how
 * the agent got there.
 */
export function ReasoningNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  if (!text.trim()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        aria-expanded={open}
        className="flex w-fit items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
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
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>

      {open ? (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap border-border border-l pl-3 text-[11px] text-muted-foreground leading-relaxed">
          {text}
        </div>
      ) : null}
    </div>
  );
}
