"use client";

import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BuildSurface } from "@/components/chat/build-surface";
import type { ChatModeId } from "@/components/chat/chat-composer";
import { ChatComposer } from "@/components/chat/chat-composer";
import {
  AnsweredQuestion,
  AskingQuestion,
} from "@/components/chat/interview-question";
import { StreamedText } from "@/components/chat/streamed-text";
import { useWordStream } from "@/components/chat/use-word-stream";
import { recommendBuildAction } from "@/lib/actions/recommend";
import type { BuildSlotRow, RecommendedBuild } from "@/lib/assistant/build";
import { validateBuild } from "@/lib/assistant/build";
import type { InterviewQuestion } from "@/lib/assistant/interview";
import {
  INTERVIEW,
  nextQuestion,
  relevantQuestions,
} from "@/lib/assistant/interview";

/**
 * The full assistant: shell, empty state, and the requirement interview.
 *
 * The build sheet is prompt 10 and docks to the right edge — which is why
 * nothing here reserves space for it. An empty column held open for something
 * that does not exist yet is worse than a centred one that widens later.
 */

/** Anything that has been said, in order. */
type Entry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "asking"; question: InterviewQuestion }
  | { id: string; kind: "answered"; questionId: string; value: string }
  | { id: string; kind: "build" };

const STARTERS = [
  "Build me a PC",
  "Compare two parts",
  "What should I upgrade?",
];

const OPENING =
  "Right — a few questions and I can put something real in front of you.";

/** Long enough that the opening line lands before the first question. */
const OPENING_MS = 900;

let seq = 0;

function nextId(prefix: string) {
  seq += 1;

  return `${prefix}-${seq}`;
}

/**
 * The interview's one server call can fail like any other request.
 *
 * Swallowing that leaves the thread sitting on the last question with no
 * indication anything went wrong, which reads as the assistant ignoring you.
 */
function report(error: unknown) {
  toast.error(
    error instanceof Error
      ? "The build could not be assembled just now."
      : "Something went wrong assembling the build."
  );
}

function ChatScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatModeId>("build");
  const [pinned, setPinned] = useState(true);
  const [build, setBuild] = useState<RecommendedBuild | null>(null);
  const [rows, setRows] = useState<BuildSlotRow[]>([]);
  const [docked, setDocked] = useState(false);

  const stream = useWordStream();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const started = entries.length > 0;

  /**
   * Asks the next question that can still change the answer, skipping any it
   * can infer and saying what it assumed.
   */
  const advance = useCallback(
    async (currentAnswers: Record<string, string>, currentSkips: string[]) => {
      let working = currentSkips;
      let question = nextQuestion(currentAnswers, working);

      while (question) {
        const inference = question.inferred?.(currentAnswers);

        if (!inference) {
          break;
        }

        working = [...working, question.id];
        setSkipped(working);
        setEntries((current) => [
          ...current,
          { id: nextId("a"), kind: "assistant", text: inference },
        ]);
        question = nextQuestion(currentAnswers, working);
      }

      if (question) {
        setEntries((current) => [
          ...current,
          { id: nextId("q"), kind: "asking", question },
        ]);
        stream.start(question.prompt.split(" ").length);

        return;
      }

      const recommended = await recommendBuildAction(currentAnswers);

      if (recommended.rows.length === 0) {
        setEntries((current) => [
          ...current,
          {
            id: nextId("a"),
            kind: "assistant",
            text: "I could not put a build together from what the store has in stock right now.",
          },
        ]);

        return;
      }

      const verdict = validateBuild(recommended.rows);
      const budget = Number(currentAnswers.budget || 0);
      const over = verdict.totalPaise / 100 - budget;

      /* If it does not fit the budget, say so before showing it. */
      const line =
        budget > 0 && over > 0
          ? `Here it is. It comes to ₹${Math.round(verdict.totalPaise / 100).toLocaleString("en-IN")}, which is ₹${Math.round(over).toLocaleString("en-IN")} over what you said — the card is the cheapest thing to change.`
          : "Here it is. Everything checked against everything else.";

      setBuild(recommended);
      setRows(recommended.rows);
      setDocked(false);
      setEntries((current) => [
        ...current,
        { id: nextId("a"), kind: "assistant", text: line },
        { id: nextId("b"), kind: "build" },
      ]);
      stream.start(line.split(" ").length);
    },
    [stream]
  );

  const onToggle = useCallback((slug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === slug ? { ...entry, selected: !entry.selected } : entry
      )
    );
  }, []);

  const onSwap = useCallback((slug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === slug ? { ...entry, swapped: true } : entry
      )
    );
  }, []);

  const onRevert = useCallback((slug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === slug ? { ...entry, swapped: false } : entry
      )
    );
  }, []);

  const onExpand = useCallback(() => setDocked(false), []);

  const onAnswer = useCallback(
    (questionId: string, value: string) => {
      const nextAnswers = { ...answers, [questionId]: value };

      setAnswers(nextAnswers);
      setEntries((current) => [
        ...current.filter(
          (entry) =>
            !(entry.kind === "asking" && entry.question.id === questionId)
        ),
        { id: nextId("r"), kind: "answered", questionId, value },
      ]);

      advance(nextAnswers, skipped).catch(report);
    },
    [advance, answers, skipped]
  );

  /**
   * Editing an answer invalidates only what actually depended on it, and
   * re-asks those. Re-running the whole interview to change one number is how
   * people learn not to press Edit.
   */
  const onEdit = useCallback(
    (questionId: string) => {
      const question = INTERVIEW.find((entry) => entry.id === questionId);
      const dropped = [questionId, ...(question?.invalidates ?? [])];

      const nextAnswers = { ...answers };

      for (const id of dropped) {
        delete nextAnswers[id];
      }

      const nextSkips = skipped.filter((id) => !dropped.includes(id));

      setAnswers(nextAnswers);
      setSkipped(nextSkips);
      setEntries((current) =>
        current.filter(
          (entry) =>
            !(
              (entry.kind === "answered" &&
                dropped.includes(entry.questionId)) ||
              (entry.kind === "asking" && dropped.includes(entry.question.id))
            )
        )
      );

      advance(nextAnswers, nextSkips).catch(report);
    },
    [advance, answers, skipped]
  );

  const send = useCallback(
    (text: string) => {
      const said = text.trim();

      if (!said) {
        return;
      }

      setDraft("");
      setEntries((current) => [
        ...current,
        { id: nextId("u"), kind: "user", text: said },
      ]);

      /*
       * Once a build exists the interview is over: carrying on with the
       * conversation docks the sheet and leaves it alone. Re-running `advance`
       * here would rebuild the recommendation from scratch and quietly throw
       * away every swap the shopper had made.
       */
      if (build) {
        setDocked(true);

        return;
      }

      setEntries((current) => [
        ...current,
        { id: nextId("a"), kind: "assistant", text: OPENING },
      ]);
      stream.start(OPENING.split(" ").length);

      window.setTimeout(
        () => advance(answers, skipped).catch(report),
        OPENING_MS
      );
    },
    [advance, answers, build, skipped, stream]
  );

  const onSend = useCallback(() => send(draft), [draft, send]);

  const onEditLast = useCallback(() => {
    const last = [...entries].reverse().find((entry) => entry.kind === "user");

    if (last && last.kind === "user") {
      setDraft(last.text);
    }
  }, [entries]);

  /* Auto-scroll follows the stream, and yields the moment you scroll up. */
  useEffect(() => {
    const node = scroller.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!(node && pinned)) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [pinned]);

  const onScroll = useCallback(() => {
    const node = scroller.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!node) {
      return;
    }

    const atBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight < 48;

    setPinned(atBottom);
  }, []);

  const jumpToLatest = useCallback(() => {
    const node = scroller.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (node) {
      node.scrollTop = node.scrollHeight;
      setPinned(true);
    }
  }, []);

  const relevant = useMemo(() => relevantQuestions(answers), [answers]);
  const askingId = entries.find((entry) => entry.kind === "asking");

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      <div
        className="flex-1 overflow-y-auto"
        onScroll={onScroll}
        ref={scroller}
      >
        <div
          className={cn(
            "mx-auto w-full max-w-[760px] px-6",
            started ? "" : "flex h-full flex-col justify-center"
          )}
        >
          {started ? (
            <div className="flex flex-col gap-8 py-12">
              {entries.map((entry) => (
                <div className="chat-turn" key={entry.id}>
                  <ThreadEntry
                    askingId={askingId?.id}
                    basis={build?.basis}
                    docked={docked}
                    entry={entry}
                    onAnswer={onAnswer}
                    onEdit={onEdit}
                    onExpand={onExpand}
                    onRevert={onRevert}
                    onSwap={onSwap}
                    onToggle={onToggle}
                    rows={rows}
                    stream={stream}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16">
              <h1 className="font-display font-semibold text-[40px] text-bone tracking-[-0.03em]">
                What are you building?
              </h1>
              <div className="mt-10">
                <ChatComposer
                  mode={mode}
                  onModeChange={setMode}
                  onSend={onSend}
                  onStop={stream.stop}
                  onValueChange={setDraft}
                  ref={composerRef}
                  streaming={stream.streaming}
                  value={draft}
                />
              </div>
              <div className="mt-6 flex flex-wrap items-center">
                {STARTERS.map((starter, index) => (
                  <div className="flex items-center" key={starter}>
                    {index > 0 ? (
                      <span aria-hidden className="mx-4 h-4 w-px bg-hairline" />
                    ) : null}
                    <StarterPill label={starter} onSend={send} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {started ? (
        <div className="border-hairline border-t bg-void">
          <div className="mx-auto w-full max-w-[760px] px-6 py-5">
            {pinned ? null : (
              <div className="flex justify-center pb-4">
                <Pill onClick={jumpToLatest} size="sm" variant="ghost">
                  Jump to latest
                </Pill>
              </div>
            )}

            <ChatComposer
              mode={mode}
              onEditLast={onEditLast}
              onModeChange={setMode}
              onSend={onSend}
              onStop={stream.stop}
              onValueChange={setDraft}
              ref={composerRef}
              streaming={stream.streaming}
              value={draft}
            />

            <div className="mt-4 flex items-center justify-center gap-2">
              {relevant.map((question) => {
                const answered = answers[question.id] !== undefined;
                const current =
                  askingId?.kind === "asking" &&
                  askingId.question.id === question.id;

                return (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      answered && "bg-bone",
                      !(answered || current) && "bg-hairline",
                      current && "bg-transparent ring-1 ring-lacquer"
                    )}
                    key={question.id}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ThreadEntryProps {
  askingId?: string;
  basis?: string;
  docked: boolean;
  entry: Entry;
  onAnswer: (questionId: string, value: string) => void;
  onEdit: (questionId: string) => void;
  onExpand: () => void;
  onRevert: (slug: string) => void;
  onSwap: (slug: string) => void;
  onToggle: (slug: string) => void;
  rows: BuildSlotRow[];
  stream: { shown: number; streaming: boolean };
}

/** One thing in the thread. Lifted out so the page reads as a page. */
function ThreadEntry({
  askingId,
  basis,
  docked,
  entry,
  onAnswer,
  onEdit,
  onExpand,
  onRevert,
  onSwap,
  onToggle,
  rows,
  stream,
}: ThreadEntryProps) {
  if (entry.kind === "user") {
    return (
      <p className="pl-16 text-right text-[17px] text-smoke">{entry.text}</p>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <div className="flex gap-3">
        <Sparkles aria-hidden className="mt-1.5 size-4 shrink-0 text-smoke" />
        <StreamedText
          className="flex-1 text-[17px] leading-relaxed"
          id={entry.id}
          shown={
            askingId === entry.id ? stream.shown : entry.text.split(" ").length
          }
          streaming={false}
          text={entry.text}
        />
      </div>
    );
  }

  if (entry.kind === "asking") {
    return (
      <AskingQuestion
        onAnswer={onAnswer}
        question={entry.question}
        shown={stream.shown}
        streaming={stream.streaming}
      />
    );
  }

  if (entry.kind === "build" && basis) {
    return (
      <BuildSurface
        basis={basis}
        docked={docked}
        onExpand={onExpand}
        onRevert={onRevert}
        onSwap={onSwap}
        onToggle={onToggle}
        rows={rows}
        verdict={validateBuild(rows)}
      />
    );
  }

  if (entry.kind === "answered") {
    const question = INTERVIEW.find((item) => item.id === entry.questionId);

    return (
      <AnsweredQuestion
        label={question?.label ?? entry.questionId}
        onEdit={onEdit}
        questionId={entry.questionId}
        value={question?.format?.(entry.value) ?? entry.value}
      />
    );
  }

  return null;
}

function StarterPill({
  label,
  onSend,
}: {
  label: string;
  onSend: (value: string) => void;
}) {
  const handleClick = useCallback(() => onSend(label), [label, onSend]);

  return (
    <Pill className="px-0" onClick={handleClick} size="sm" variant="text">
      {label}
    </Pill>
  );
}

export { ChatScreen };
