"use client";

import type { PageContextInput } from "@workspace/ai";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowUp, Sparkles, Square } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PillLink } from "@/components/common/pill-link";
import type { DockTurn } from "@/components/dock/dock-thread";
import { DockThread } from "@/components/dock/dock-thread";
import { dockReply, dockStarters } from "@/lib/mock/chat";
import { route } from "@/lib/routes";

/**
 * The corner assistant.
 *
 * It does three jobs — what is this, compare two parts, show my list — and
 * says so when asked for anything else. That refusal is the design, not a
 * shortfall: a panel that quietly attempts everything is one you cannot trust
 * with anything, and the handoff to the full assistant is one press away.
 *
 * Mounted per page rather than in the layout, because each page has to hand it
 * its own `PageContextInput` — the dock's whole value is knowing what you are
 * looking at.
 */

/** Roughly the cadence of someone thinking, not a typewriter. */
const WORD_MS = 90;

interface AssistantDockProps {
  /** What the page can see, in the shape `packages/ai` already expects. */
  context: PageContextInput;
  /** The human name for it — "RTX 5070 Ti". */
  contextLabel?: string;
  /** Carried to /assistant so the thread continues rather than restarting. */
  conversationId?: string;
  /** Whether this page has something worth saying. Drives the dot. */
  hasNews?: boolean;
}

let turnId = 0;

function AssistantDock({
  context,
  contextLabel,
  conversationId = "dock",
  hasNews = false,
}: AssistantDockProps) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<DockTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleId = useId();

  const starters = dockStarters(Boolean(context.productId));

  const stop = useCallback(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: the timer only exists while streaming
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }

    setStreaming(false);
    setTurns((current) =>
      current.map((turn) =>
        turn.role === "assistant"
          ? { ...turn, shown: turn.text.split(" ").length }
          : turn
      )
    );
  }, []);

  useEffect(() => () => stop(), [stop]);

  const send = useCallback(
    (prompt: string) => {
      const asked = prompt.trim();

      if (!asked || streaming) {
        return;
      }

      const reply = dockReply(asked, context.productId);
      const words = reply.text.split(" ").length;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      turnId += 1;
      const answerId = `a${turnId}`;

      setDraft("");
      setTurns((current) => [
        ...current,
        { id: `u${turnId}`, role: "user", shown: 0, text: asked },
        {
          beyond: reply.intent === "beyond",
          id: answerId,
          result: reply.result,
          role: "assistant",
          /* Reduced motion gets the finished answer, not a faster reveal. */
          shown: reduced ? words : 0,
          text: reply.text,
          tool: reply.tool,
        },
      ]);

      if (reduced) {
        return;
      }

      setStreaming(true);
      timer.current = setInterval(() => {
        setTurns((current) => {
          const next = current.map((turn) =>
            turn.id === answerId
              ? { ...turn, shown: Math.min(turn.shown + 1, words) }
              : turn
          );

          if (next.at(-1)?.shown === words) {
            // biome-ignore lint/suspicious/noUnnecessaryConditions: the interval clears itself on the last word
            if (timer.current) {
              clearInterval(timer.current);
              timer.current = null;
            }

            setStreaming(false);
          }

          return next;
        });
      }, WORD_MS);
    },
    [context.productId, streaming]
  );

  const onSend = useCallback(() => send(draft), [draft, send]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send(draft);
      }
    },
    [draft, send]
  );

  const onDraft = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);

    const field = event.target;

    /* Grows to four lines, then scrolls. */
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 96)}px`;
  }, []);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  /* Escape closes, and focus lands in the composer once the mask is done. */
  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = setTimeout(() => inputRef.current?.focus(), 420);

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {open ? null : (
        <button
          className="dock-surface fixed right-6 bottom-6 z-50 flex h-12 items-center gap-2.5 rounded-full border border-hairline bg-panel/80 px-5 text-[13px] text-bone shadow-float backdrop-blur-[16px] transition-colors duration-[180ms] hover:border-smoke lg:right-8 lg:bottom-8"
          onClick={toggle}
          type="button"
        >
          <Sparkles aria-hidden className="size-4" />
          Ask
          {hasNews ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-[5px] rounded-full bg-lacquer"
            />
          ) : null}
        </button>
      )}

      <div
        aria-labelledby={titleId}
        aria-modal={open}
        className={cn(
          "dock-surface centre-mask fixed z-50 flex flex-col overflow-hidden rounded-[28px] border border-hairline bg-panel/95 shadow-float backdrop-blur-[28px]",
          "max-md:inset-x-0 max-md:bottom-0 max-md:h-[85dvh] max-md:rounded-b-none",
          "md:right-8 md:bottom-8 md:h-[560px] md:w-[380px]"
        )}
        data-open={open}
        inert={!open}
        ref={panelRef}
        role="dialog"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div className="centre-mask-inner flex h-full flex-col">
          {/* The handle is the mobile affordance; on desktop it is not drawn. */}
          <span
            aria-hidden
            className="mx-auto mt-3 h-1 w-10 rounded-full bg-hairline md:hidden"
          />

          <div className="flex items-start justify-between gap-4 border-hairline border-b px-5 py-4">
            <div>
              <p className="text-[15px] text-bone" id={titleId}>
                Assistant
              </p>
              <Label className="mt-1 block">
                {contextLabel
                  ? `Viewing: ${contextLabel}`
                  : `Page: ${context.page}`}
              </Label>
            </div>
            <Pill onClick={close} size="sm" variant="text">
              Close
            </Pill>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {turns.length === 0 ? (
              <div className="border-hairline border-t">
                {starters.map((starter) => (
                  <StarterRow
                    key={starter.id}
                    label={starter.label}
                    meta={starter.meta}
                    onSend={send}
                    value={starter.value}
                  />
                ))}
              </div>
            ) : (
              <DockThread streaming={streaming} turns={turns} />
            )}
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-end gap-2 rounded-[24px] border border-hairline bg-void px-4 py-2.5">
              <textarea
                className="max-h-24 min-h-6 flex-1 resize-none bg-transparent text-[13px] text-bone placeholder:text-smoke focus:outline-none"
                onChange={onDraft}
                onKeyDown={onKeyDown}
                placeholder="Ask about this product…"
                ref={inputRef}
                rows={1}
                value={draft}
              />
              <button
                aria-label={streaming ? "Stop" : "Send"}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lacquer text-white transition-colors duration-[180ms] hover:bg-ember"
                onClick={streaming ? stop : onSend}
                type="button"
              >
                {streaming ? (
                  <Square aria-hidden className="size-3 fill-current" />
                ) : (
                  <ArrowUp aria-hidden className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-hairline border-t px-5 py-3">
            <Label>Quick mode</Label>
            <PillLink
              className="px-0"
              href={route(`/assistant?conversationId=${conversationId}`)}
              variant="text"
            >
              Open full assistant →
            </PillLink>
          </div>
        </div>
      </div>
    </>
  );
}

function StarterRow({
  label,
  meta,
  onSend,
  value,
}: {
  label: string;
  meta?: string;
  onSend: (value: string) => void;
  value: string;
}) {
  const handleClick = useCallback(() => onSend(value), [onSend, value]);

  return (
    <button
      className="flex w-full items-center gap-3 border-hairline border-b py-3.5 text-left transition-colors duration-[180ms] hover:text-bone"
      onClick={handleClick}
      type="button"
    >
      <span className="flex-1 text-[13px] text-bone">{label}</span>
      {meta ? (
        <span className="font-mono text-[13px] text-bone tabular-nums">
          {meta}
        </span>
      ) : null}
      <span aria-hidden className="text-[13px] text-smoke">
        →
      </span>
    </button>
  );
}

export { AssistantDock };
