"use client";

import { useCallback, useState } from "react";
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
 * The summary is rendered on arrival, before anything is typed, because the
 * answer to "how is the store" should not require the operator to ask. The
 * composer underneath is for the follow-up, and the thread grows below the
 * briefing rather than replacing it — the numbers stay on screen while you
 * interrogate them.
 *
 * The follow-up is the real merchant agent now, streaming from
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

  const {
    addToolApprovalResponse,
    busy,
    error,
    messages,
    regenerate,
    sendMessage,
    stop,
  } = useMerchantAssistant({ merchantId, rangeDays: summary.range.days });

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
    <div className="mx-auto flex min-h-dvh w-full max-w-[820px] flex-col px-5 pt-16 pb-10 sm:px-8">
      <header>
        <h1 className="font-display font-semibold text-[32px] text-bone leading-none tracking-[-0.02em]">
          Here&rsquo;s where the store stands, {operator}.
        </h1>
        <div className="mt-3">
          <RangeMenu current={summary.range} ranges={ranges} />
        </div>
      </header>

      {razorpayConnected ? null : <ConnectRazorpayNotice />}

      {/* Above the briefing on purpose: it is the only thing on this page
          that happened since the merchant last looked. */}
      <OvernightBlock merchantId={merchantId} />

      {/* 56px between blocks. The briefing is six things, read top to bottom. */}
      <div className="mt-14 grid gap-14">
        <Earnings summary={summary} />
        <Orders summary={summary} />
        <SellingWell rows={summary.sellingWell} />
        <SeenNotBought rows={summary.seenNotBought} />
        <NeverSeen rows={summary.neverSeen} />
        <FindingsList findings={summary.findings} />
      </div>

      {messages.length > 0 ? (
        <div className="rule-section mt-14 pt-14">
          <ManagerThread
            busy={busy}
            error={error}
            messages={messages}
            onApproval={addToolApprovalResponse}
            onRetry={regenerate}
          />
        </div>
      ) : null}

      <div className="mt-14 pt-2">
        {messages.length === 0 ? (
          <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  className="text-[15px] text-smoke outline-none transition-colors duration-[180ms] hover:text-bone focus-visible:text-bone"
                  onClick={() => ask(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
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
  );
}

export { ManagerScreen };
