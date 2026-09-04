"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useWordStream } from "@/components/chat/use-word-stream";
import { ConnectRazorpayNotice } from "@/components/manager/connect-razorpay-notice";
import { FindingsList } from "@/components/manager/findings-list";
import { ManagerComposer } from "@/components/manager/manager-composer";
import type { ManagerTurn } from "@/components/manager/manager-thread";
import { ManagerThread } from "@/components/manager/manager-thread";
import { RangeMenu } from "@/components/manager/range-menu";
import {
  Earnings,
  NeverSeen,
  Orders,
  SeenNotBought,
  SellingWell,
} from "@/components/manager/summary-blocks";
import { managerReplyAction } from "@/lib/actions/manager";
import type { ManagerRange, ManagerSummary } from "@/lib/data/types";

/**
 * The manager's page, which is the assistant.
 *
 * The summary is rendered on arrival, before anything is typed, because the
 * answer to "how is the store" should not require the operator to ask. The
 * composer underneath is for the follow-up, and the thread grows below the
 * briefing rather than replacing it — the numbers stay on screen while you
 * interrogate them.
 */

function ManagerScreen({
  operator,
  ranges,
  razorpayConnected,
  summary,
}: {
  /** Whoever the store belongs to. The greeting is the whole page header. */
  operator: string;
  ranges: ManagerRange[];
  /** Whether the store bills through its own Razorpay account yet. */
  razorpayConnected: boolean;
  summary: ManagerSummary;
}) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ManagerTurn[]>([]);
  const stream = useWordStream();

  const onSend = useCallback(async () => {
    const question = draft.trim();

    if (question.length === 0) {
      return;
    }

    setDraft("");

    const reply = await managerReplyAction(question, summary.range.id);

    setTurns((current) => [
      ...current,
      {
        id: `turn-${current.length}`,
        question,
        reply: reply.text,
        result: reply.result,
      },
    ]);
    stream.start(reply.text.split(" ").length);
  }, [draft, stream, summary.range.id]);

  const send = useCallback(() => {
    onSend().catch(() =>
      toast.error("The store's numbers could not be read just now.")
    );
  }, [onSend]);

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

      {/* 56px between blocks. The briefing is six things, read top to bottom. */}
      <div className="mt-14 grid gap-14">
        <Earnings summary={summary} />
        <Orders summary={summary} />
        <SellingWell rows={summary.sellingWell} />
        <SeenNotBought rows={summary.seenNotBought} />
        <NeverSeen rows={summary.neverSeen} />
        <FindingsList findings={summary.findings} />
      </div>

      {turns.length > 0 ? (
        <div className="mt-14 border-hairline border-t pt-14">
          <ManagerThread
            shown={stream.shown}
            streaming={stream.streaming}
            turns={turns}
          />
        </div>
      ) : null}

      <div className="mt-14 pt-2">
        <ManagerComposer
          onSend={send}
          onStop={stream.stop}
          onValueChange={setDraft}
          streaming={stream.streaming}
          value={draft}
        />
      </div>
    </div>
  );
}

export { ManagerScreen };
