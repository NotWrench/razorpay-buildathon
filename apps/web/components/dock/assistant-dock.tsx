"use client";

import type { PageContextInput } from "@workspace/ai";
import { Label } from "@workspace/ui/components/label";
import { Shimmer } from "@workspace/ui/components/motion/shimmer";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowUp, Sparkles, Square, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { PillLink } from "@/components/common/pill-link";
import type { DockTurn } from "@/components/dock/dock-thread";
import { DockThread } from "@/components/dock/dock-thread";
import { dockReplyAction, dockStartersAction } from "@/lib/actions/dock";
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

/** A dock that cannot reach the store should say so, not go quiet. */
function reportDockFailure() {
  toast.error("The assistant could not reach the store just now.");
}

function AssistantDock({
  context,
  contextLabel,
  conversationId = "dock",
  hasNews = false,
}: AssistantDockProps) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<DockTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  /*
   * Waiting on the server, which is not the same as revealing an answer. The
   * gap between pressing send and the first word used to be silence with an
   * unchanged panel, which reads as a broken button.
   */
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [starters, setStarters] = useState<DockStarter[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleId = useId();

  const retry = useCallback(() => setFailed(false), []);

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
    async (prompt: string) => {
      const asked = prompt.trim();

      if (!asked || streaming) {
        return;
      }

      turnId += 1;
      const answerId = `a${turnId}`;
      const askedId = `u${turnId}`;

      setDraft("");
      setFailed(false);
      setTurns((current) => [
        ...current,
        { id: askedId, role: "user", shown: 0, text: asked },
      ]);

      setPending(true);

      let reply: Awaited<ReturnType<typeof dockReplyAction>>;

      try {
        reply = await dockReplyAction(asked, context.productId);
      } catch (error) {
        /* Shown in the thread, next to the question it failed to answer —
           a toast that has already faded helps nobody. */
        setFailed(true);

        throw error;
      } finally {
        setPending(false);
      }

      const words = reply.text.split(" ").length;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      setTurns((current) => [
        ...current,
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

  const onSend = useCallback(() => {
    send(draft).catch(reportDockFailure);
  }, [draft, send]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send(draft).catch(reportDockFailure);
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

  /* The starter rows quote the basket's real total, so they are fetched when
     the panel first opens rather than on every page render. */
  useEffect(() => {
    if (!open || starters.length > 0) {
      return;
    }

    let cancelled = false;

    dockStartersAction(Boolean(context.productId))
      .then((rows) => {
        if (!cancelled) {
          setStarters(rows);
        }
      })
      .catch(reportDockFailure);

    return () => {
      cancelled = true;
    };
  }, [context.productId, open, starters.length]);

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

  /*
   * The placeholder used to say "Ask about this product…" on every page,
   * including the cart and the home page, where there is no product.
   */
  const subject =
    contextLabel && contextLabel.length > 28
      ? `${contextLabel.slice(0, 28).trimEnd()}…`
      : contextLabel;

  let placeholder = "Ask about anything in the store…";

  if (subject) {
    placeholder = `Ask about ${subject}…`;
  } else if (context.page === "cart") {
    placeholder = "Ask about your cart…";
  } else if (context.page === "search") {
    placeholder = "Ask about these parts…";
  }

  return (
    <>
      {/*
        The pill stays mounted and fades under the panel rather than being
        unmounted the moment it opens. Two elements swapping is what made the
        open read as a jump; one surface handing off to another reads as a
        movement.
      */}
      <button
        aria-expanded={open}
        aria-label="Open the assistant"
        className={cn(
          "t-body-sm dock-surface surface-float fixed right-6 bottom-6 z-50 flex h-12 items-center gap-2.5 rounded-full border border-hairline bg-panel/80 px-5 text-bone backdrop-blur-[16px] lg:right-8 lg:bottom-8",
          "transition-[opacity,transform,border-color] duration-exit hover:border-smoke",
          open
            ? "pointer-events-none scale-95 opacity-0"
            : "scale-100 opacity-100"
        )}
        onClick={toggle}
        tabIndex={open ? -1 : undefined}
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

      {/*
        A scrim, on small screens only. An 85dvh panel floating over a live,
        clickable page is a panel you dismiss by accident.
      */}
      <button
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-void/60 backdrop-blur-[2px] transition-opacity duration-exit md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        tabIndex={-1}
        type="button"
      />

      <div
        aria-labelledby={titleId}
        aria-modal={open}
        className={cn(
          "dock-surface centre-mask surface-float fixed z-50 flex flex-col overflow-hidden rounded-[28px] border border-hairline bg-panel/95 backdrop-blur-[28px]",
          "max-md:inset-x-0 max-md:bottom-0 max-md:h-[85dvh] max-md:rounded-b-none",
          "md:right-8 md:bottom-8 md:h-[560px] md:w-[380px]"
        )}
        data-open={open}
        inert={!open}
        role="dialog"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div className="centre-mask-inner flex h-full flex-col">
          {/* The handle is the mobile affordance; on desktop it is not drawn. */}
          <span
            aria-hidden
            className="mx-auto mt-3 h-1 w-10 rounded-full bg-hairline md:hidden"
          />

          <div className="flex items-center gap-3 border-hairline border-b px-5 py-4">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-riser"
            >
              <Sparkles className="size-4 text-bone" />
            </span>

            <div className="min-w-0 flex-1">
              <p
                className="t-body flex items-center gap-2 text-bone"
                id={titleId}
              >
                Assistant
                <span
                  aria-hidden
                  className="size-[5px] shrink-0 rounded-full bg-lacquer"
                />
              </p>
              <p className="t-label truncate text-smoke">
                {contextLabel ?? `Page: ${context.page}`}
              </p>
            </div>

            <button
              aria-label="Close the assistant"
              className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:bg-riser hover:text-bone"
              onClick={close}
              type="button"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {turns.length === 0 ? (
              <div>
                {/* There used to be nothing above the starters at all. */}
                <p className="t-body text-bone">
                  Ask me about anything on this page.
                </p>
                <p className="t-body-sm mt-1.5 text-smoke">
                  I answer from this store&rsquo;s own catalogue — three things
                  quickly, and I hand the rest to the full assistant.
                </p>

                <div className="mt-5 border-hairline border-t">
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
              </div>
            ) : (
              <DockThread streaming={streaming} turns={turns} />
            )}

            {pending ? (
              <div className="mt-5 flex items-center gap-2.5">
                <Sparkles
                  aria-hidden
                  className="size-3.5 shrink-0 animate-pulse text-smoke"
                />
                <Shimmer className="h-3 w-40" radius="pill" />
              </div>
            ) : null}

            {failed ? (
              <div className="mt-5">
                <StatusLine
                  message="That did not reach the store. Try it again."
                  state="incompatible"
                />
                <Pill
                  className="mt-3"
                  onClick={retry}
                  size="sm"
                  variant="ghost"
                >
                  Dismiss
                </Pill>
              </div>
            ) : null}
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-end gap-2 rounded-[24px] border border-hairline bg-void px-4 py-2.5 transition-colors duration-micro focus-within:border-smoke">
              <textarea
                aria-label="Ask the assistant"
                className="t-body-sm max-h-24 min-h-6 flex-1 resize-none bg-transparent text-bone placeholder:text-smoke focus:outline-none"
                onChange={onDraft}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                ref={inputRef}
                rows={1}
                value={draft}
              />
              <button
                aria-label={streaming ? "Stop" : "Send"}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lacquer text-white transition-colors duration-micro hover:bg-ember disabled:opacity-40"
                disabled={!(streaming || draft.trim())}
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

interface DockStarter {
  id: string;
  label: string;
  meta?: string;
  value: string;
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

  /*
   * The hover used to be `hover:text-bone` on a label that was already bone,
   * so the row looked interactive and then did nothing when you pointed at it.
   * The ground moves instead, which is what a list row should do.
   */
  return (
    <button
      className="group -mx-2 flex w-full items-center gap-3 rounded-[12px] border-hairline border-b px-2 py-3.5 text-left transition-colors duration-micro hover:bg-riser"
      onClick={handleClick}
      type="button"
    >
      <span className="t-body-sm flex-1 text-bone">{label}</span>
      {meta ? <span className="t-num-xs text-smoke">{meta}</span> : null}
      <span
        aria-hidden
        className="t-body-sm text-smoke transition-transform duration-micro group-hover:translate-x-0.5 group-hover:text-bone"
      >
        →
      </span>
    </button>
  );
}

export { AssistantDock };
