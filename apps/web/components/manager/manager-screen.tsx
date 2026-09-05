"use client";

import { Pill } from "@workspace/ui/components/pill";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectRazorpayNotice } from "@/components/manager/connect-razorpay-notice";
import { FindingsList } from "@/components/manager/findings-list";
import { ManagerComposer } from "@/components/manager/manager-composer";
import { ManagerThread } from "@/components/manager/manager-thread";
import { OvernightBlock } from "@/components/manager/overnight-block";
import { RangeMenu } from "@/components/manager/range-menu";
import {
  Earnings,
  NeverSeen,
  Orders,
  SeenNotBought,
  SellingWell,
} from "@/components/manager/summary-blocks";
import { useMerchantAssistant } from "@/hooks/use-merchant-assistant";
import type { ManagerRange, ManagerSummary } from "@/lib/data/types";

/**
 * The manager's page, which is the assistant.
 *
 * Three regions, and only the middle one scrolls: the greeting stays, the
 * briefing and the thread scroll between them, and the composer is pinned to
 * the bottom of the viewport. It used to be the last element in a page-flow
 * column, which meant asking a question began with scrolling past every number
 * on the screen — the summary answers "how is the store" so that you do not
 * have to ask it, and then made asking anything else the hardest thing here.
 *
 * The summary is still rendered on arrival and still sits above the thread:
 * the numbers stay on screen while you interrogate them.
 *
 * The follow-up is the real merchant agent, streaming from
 * `/api/agent/merchant`: it pulls the store's own numbers through its tools,
 * and every action that moves money suspends mid-turn for a card the merchant
 * has to press. The briefing and the thread therefore agree by construction —
 * the window selected above is sent with the turn, so the agent measures over
 * the same period the operator is reading.
 */

const SUGGESTIONS = [
  "What should I discount this week?",
  "Anything waiting on my approval?",
  "What am I about to run out of?",
] as const;

function Suggestion({
  onPick,
  text,
}: {
  onPick: (text: string) => void;
  text: string;
}) {
  const pick = useCallback(() => onPick(text), [onPick, text]);

  return (
    <Pill onClick={pick} size="sm" variant="ghost">
      {text}
    </Pill>
  );
}

function ManagerScreen({
  merchantId,
  operator,
  ranges,
  razorpayConnected,
  summary,
}: {
  /** Which store the assistant's tools are pointed at. Re-checked server-side. */
  merchantId: string;
  /** Whoever the store belongs to. The greeting is the whole page header. */
  operator: string;
  ranges: ManagerRange[];
  /** Whether the store bills through its own Razorpay account yet. */
  razorpayConnected: boolean;
  summary: ManagerSummary;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    addToolApprovalResponse,
    busy,
    error,
    messages,
    regenerate,
    sendMessage,
    stop,
  } = useMerchantAssistant({ merchantId, rangeDays: summary.range.days });

  /*
   * The thread grows below a briefing that does not move, so a new turn lands
   * entirely below the fold — the operator would have to go looking for the
   * answer they just asked for.
   *
   * The scroll is set on the container rather than by asking a marker element
   * to bring itself into view: the turn is one frame away from being laid out
   * when the effect runs, so a frame is waited for and the container is told
   * where to go.
   */
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const node = scrollRef.current;

      // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
      if (!node) {
        return;
      }

      node.scrollTo({ behavior: "smooth", top: node.scrollHeight });
    });

    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  const ask = useCallback(
    (text: string) => {
      const question = text.trim();

      if (question.length === 0 || busy) {
        return;
      }

      setDraft("");
      sendMessage({ text: question });
    },
    [busy, sendMessage]
  );

  const send = useCallback(() => ask(draft), [ask, draft]);

  return (
    <div className="flex h-[calc(100dvh-var(--manager-rail))] flex-col lg:h-dvh">
      <header className="shrink-0 px-5 pt-10 pb-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <h1 className="t-display-sm text-bone leading-none">
            Here&rsquo;s where the store stands, {operator}.
          </h1>
          <RangeMenu current={summary.range} ranges={ranges} />
        </div>
      </header>

      {/* The one scrolling region on the page. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-8"
        ref={scrollRef}
      >
        <div className="mx-auto w-full max-w-[1180px] pb-10">
          {razorpayConnected ? null : (
            <div className="pb-4">
              <ConnectRazorpayNotice />
            </div>
          )}

          {/* Above the briefing on purpose: it is the only thing on this page
              that happened since the merchant last looked. */}
          <OvernightBlock merchantId={merchantId} />

          {/* Three figures across the top: what came in, and what is waiting. */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Earnings summary={summary} />
            <Orders summary={summary} />
          </div>

          {/* The three product readings, side by side rather than stacked. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <SellingWell rows={summary.sellingWell} />
            <SeenNotBought rows={summary.seenNotBought} />
            <NeverSeen rows={summary.neverSeen} />
          </div>

          <div className="mt-10">
            <FindingsList findings={summary.findings} />
          </div>

          {messages.length > 0 ? (
            <div className="rule-section mt-10 pt-10">
              <ManagerThread
                busy={busy}
                error={error}
                messages={messages}
                onApproval={addToolApprovalResponse}
                onRetry={regenerate}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-hairline border-t bg-void px-5 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          {messages.length === 0 ? (
            /* One line that scrolls, not two that wrap: the composer is
               pinned and every row above it is a row taken off the briefing. */
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
              {SUGGESTIONS.map((suggestion) => (
                <Suggestion key={suggestion} onPick={ask} text={suggestion} />
              ))}
            </div>
          ) : null}

          <ManagerComposer
            onSend={send}
            onStop={stop}
            onValueChange={setDraft}
            streaming={busy}
            value={draft}
          />
        </div>
      </div>
    </div>
  );
}

export { ManagerScreen };
