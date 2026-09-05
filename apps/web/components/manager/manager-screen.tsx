"use client";

import { Pill } from "@workspace/ui/components/pill";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useWordStream } from "@/components/chat/use-word-stream";
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
 * Three regions, and only the middle one scrolls: the greeting stays, the
 * briefing and the thread scroll between them, and the composer is pinned to
 * the bottom of the viewport. It used to be the last element in a page-flow
 * column, which meant asking a question began with scrolling past every number
 * on the screen — the summary answers "how is the store" so that you do not
 * have to ask it, and then made asking anything else the hardest thing here.
 *
 * The summary is still rendered on arrival and still sits above the thread:
 * the numbers stay on screen while you interrogate them.
 */

/**
 * Four openings, one per branch the reply matcher actually has.
 *
 * These are prompts, not answers — nothing here is a figure. Each one is
 * worded to land on a real branch (`sales`, `stock`, `what should`, and the
 * execute guard) so that pressing one never dead-ends in the fallback.
 */
const STARTERS = [
  "What sold best this window?",
  "What is running low on stock?",
  "What should I do first?",
  "Reorder the parts below threshold",
];

function Starter({
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
  operator,
  ranges,
  summary,
}: {
  /** Whoever the store belongs to. The greeting is the whole page header. */
  operator: string;
  ranges: ManagerRange[];
  summary: ManagerSummary;
}) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ManagerTurn[]>([]);
  const stream = useWordStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
   * The thread grows below a briefing that does not move, so a new turn lands
   * entirely below the fold — the operator would have to go looking for the
   * answer they just asked for.
   *
   * The scroll is set on the container rather than by asking a marker element
   * to bring itself into view: the marker is zero-height and the turn is one
   * frame away from being laid out when the effect runs, so a frame is waited
   * for and the container is told where to go.
   */
  useEffect(() => {
    if (turns.length === 0) {
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
  }, [turns.length]);

  const ask = useCallback(
    async (question: string) => {
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
    },
    [stream, summary.range.id]
  );

  const run = useCallback(
    (question: string) => {
      ask(question).catch(() =>
        toast.error("The store's numbers could not be read just now.")
      );
    },
    [ask]
  );

  const send = useCallback(() => {
    const question = draft.trim();

    if (question.length === 0) {
      return;
    }

    setDraft("");
    run(question);
  }, [draft, run]);

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
          {/* Three figures across the top: what came in, and what is waiting. */}
          <div className="grid gap-4 sm:grid-cols-3">
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

          {turns.length > 0 ? (
            <div className="rule-section mt-10 pt-10">
              <ManagerThread
                shown={stream.shown}
                streaming={stream.streaming}
                turns={turns}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-hairline border-t bg-void px-5 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          {turns.length === 0 ? (
            /* One line that scrolls, not two that wrap: the composer is
               pinned and every row above it is a row taken off the briefing. */
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
              {STARTERS.map((text) => (
                <Starter key={text} onPick={run} text={text} />
              ))}
            </div>
          ) : null}

          <ManagerComposer
            onSend={send}
            onStop={stream.stop}
            onValueChange={setDraft}
            streaming={stream.streaming}
            value={draft}
          />
        </div>
      </div>
    </div>
  );
}

export { ManagerScreen };
