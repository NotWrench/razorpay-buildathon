"use client";

import type { PageContextInput } from "@workspace/ai";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { cn } from "@workspace/ui/lib/utils";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AgentMessage,
  AgentTurnHandlers,
  RazorpayCheckout,
} from "@/components/chat/agent-turn";
import { AgentTurn } from "@/components/chat/agent-turn";
import { BuildSurface } from "@/components/chat/build-surface";
import type { ChatModeId } from "@/components/chat/chat-composer";
import { ChatComposer } from "@/components/chat/chat-composer";
import {
  AnsweredQuestion,
  AskingQuestion,
} from "@/components/chat/interview-question";
import { StreamedText } from "@/components/chat/streamed-text";
import { useWordStream } from "@/components/chat/use-word-stream";
import { useRazorpay } from "@/hooks/use-razorpay";
import { useStorefrontAssistant } from "@/hooks/use-storefront-assistant";
import { recommendBuildAction } from "@/lib/actions/recommend";
import { saveAssistantBuildAction } from "@/lib/actions/storefront";
import type { BuildSlotRow, RecommendedBuild } from "@/lib/assistant/build";
import { partFor, validateBuild } from "@/lib/assistant/build";
import type { InterviewQuestion } from "@/lib/assistant/interview";
import {
  INTERVIEW,
  nextQuestion,
  relevantQuestions,
} from "@/lib/assistant/interview";

/**
 * The full assistant: shell, empty state, the requirement interview, and the
 * model.
 *
 * Two things answer here, and which one does is a decision this file makes
 * rather than a thing the shopper has to know about:
 *
 * - The **interview and the build sheet** are deterministic. §4 says
 *   safety-critical commerce validation must not depend on model reasoning,
 *   and picking eight parts that fit each other is exactly that.
 * - **Everything else** is the real agent over `/api/agent/chat` — the same
 *   tools, the same grounding rules and the same approval gates the rest of
 *   the platform uses. A question the interview cannot answer used to be
 *   swallowed; now it is answered.
 *
 * The sheet is written down as a real build as it changes, so when the
 * conversation continues past it the agent is looking at the same parts the
 * shopper is. See `saveAssistantBuildAction`.
 *
 * The sheet itself docks to the right edge, which is why nothing here reserves
 * space for it. An empty column held open for something that does not exist
 * yet is worse than a centred one that widens later.
 */

/** Anything that has been said, in order. */
type Entry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "asking"; question: InterviewQuestion }
  | { id: string; kind: "answered"; questionId: string; value: string }
  | { id: string; kind: "build" }
  /** A turn of the real agent, drawn from the message it anchors. */
  | { id: string; kind: "agent"; messageId: string };

/** The opening rows, and the task each one actually is. */
const STARTERS: { label: string; mode: ChatModeId }[] = [
  { label: "Build me a PC", mode: "build" },
  { label: "Compare two parts", mode: "compare" },
  { label: "What should I upgrade?", mode: "recommend" },
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

interface ChatScreenProps {
  /** The store this assistant shops in, for the agent endpoint. */
  slug: string;
  /** Shown on the payment window, which is the shopper's own bank statement. */
  storeName: string;
}

function ChatScreen({ slug, storeName }: ChatScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState(true);
  const [build, setBuild] = useState<RecommendedBuild | null>(null);
  const [rows, setRows] = useState<BuildSlotRow[]>([]);
  const [docked, setDocked] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);

  const stream = useWordStream();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /*
   * §7's page context. A shopper on this page is on no page in particular
   * until a build exists — after that "swap the card" has a referent, and the
   * agent's builder tools can work on the very rows the sheet is drawing.
   */
  const context = useMemo<PageContextInput>(
    () => (buildId ? { buildId, page: "build" } : { page: "home" }),
    [buildId]
  );

  const assistant = useStorefrontAssistant({
    context,
    initialMode: "build",
    slug,
  });

  const { messages, sendMessage } = assistant;
  const { open, paying } = useRazorpay();

  const started = entries.length > 0;

  /*
   * Every message the SDK holds gets exactly one place in the thread.
   *
   * Anchoring rather than pushing at send time is what makes the turns the SDK
   * sends on its own — the continuation after an approval — land in order
   * instead of appearing twice or not at all.
   */
  const anchored = useRef(new Set<string>());

  useEffect(() => {
    const fresh = messages.filter(
      (message) => !anchored.current.has(message.id)
    );

    if (fresh.length === 0) {
      return;
    }

    for (const message of fresh) {
      anchored.current.add(message.id);
    }

    setEntries((current) => [
      ...current,
      ...fresh.map((message) => ({
        id: `m-${message.id}`,
        kind: "agent" as const,
        messageId: message.id,
      })),
    ]);
  }, [messages]);

  /*
   * The sheet, written down so the agent can see it.
   *
   * Saves are chained rather than fired in parallel: two ticks in quick
   * succession would otherwise race, and the one that lost would either create
   * a second build or write the older selection last.
   */
  const saving = useRef<Promise<void>>(Promise.resolve());
  const savedParts = useRef("");
  const savedBuildId = useRef<string | null>(null);

  useEffect(() => {
    const productIds = rows
      .filter((row) => row.selected)
      .map((row) => partFor(row).id);

    if (productIds.length === 0) {
      return;
    }

    const signature = productIds.join(",");

    saving.current = saving.current
      .then(async () => {
        if (signature === savedParts.current) {
          return;
        }

        const result = await saveAssistantBuildAction({
          buildId: savedBuildId.current ?? undefined,
          productIds,
        });

        /*
         * A build that could not be saved costs the agent its view of the
         * sheet and costs the shopper nothing — the sheet, the compatibility
         * verdict and the checkout handoff all still work off the rows in the
         * browser. So this is quiet on purpose; a toast here would be an alarm
         * about something the shopper cannot act on.
         */
        if (!result.ok) {
          return;
        }

        savedParts.current = signature;
        savedBuildId.current = result.data.buildId;
        setBuildId(result.data.buildId);
      })
      .catch(() => {
        /* Keeps the chain alive for the next change. */
      });
  }, [rows]);

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

  const onToggle = useCallback((partSlug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === partSlug
          ? { ...entry, selected: !entry.selected }
          : entry
      )
    );
  }, []);

  const onSwap = useCallback((partSlug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === partSlug ? { ...entry, swapped: true } : entry
      )
    );
  }, []);

  const onRevert = useCallback((partSlug: string) => {
    setRows((current) =>
      current.map((entry) =>
        entry.slug === partSlug ? { ...entry, swapped: false } : entry
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

  /**
   * Where a message goes.
   *
   * The interview owns the opening move of a build and nothing else. Once it
   * is under way — and always, in every other mode — what the shopper types is
   * a question for the agent, which is the whole point of the composer never
   * disabling itself: you can ignore the question on screen and say what you
   * actually want.
   */
  const send = useCallback(
    (text: string, task: ChatModeId) => {
      const said = text.trim();

      if (!said) {
        return;
      }

      setDraft("");

      if (task === "build" && !started) {
        setEntries((current) => [
          ...current,
          { id: nextId("u"), kind: "user", text: said },
          { id: nextId("a"), kind: "assistant", text: OPENING },
        ]);
        stream.start(OPENING.split(" ").length);

        window.setTimeout(
          () => advance(answers, skipped).catch(report),
          OPENING_MS
        );

        return;
      }

      /*
       * Carrying on past a build docks the sheet rather than rebuilding it.
       * The agent works on the saved copy from here, so a swap it makes and a
       * swap the shopper makes are edits to the same build rather than to two
       * that disagree.
       */
      if (build) {
        setDocked(true);
      }

      sendMessage({ text: said }, { mode: task });
    },
    [advance, answers, build, sendMessage, skipped, started, stream]
  );

  const mode = assistant.mode ?? "build";

  const onSend = useCallback(() => send(draft, mode), [draft, mode, send]);

  /** Stops the reveal clock and the model — whichever of them is running. */
  const onStop = useCallback(() => {
    stream.stop();
    assistant.stop();
  }, [assistant, stream]);

  /** Runs the failed turn again. Wrapped so the click event is not an option. */
  const onRetry = useCallback(() => {
    assistant.regenerate();
  }, [assistant]);

  const onEditLast = useCallback(() => {
    const last = [...entries].reverse().find((entry) => entry.kind === "user");

    if (last && last.kind === "user") {
      setDraft(last.text);
    }
  }, [entries]);

  const handlers = useMemo<AgentTurnHandlers>(
    () => ({
      /*
       * The buyer's tap *is* the tool's output — `askBuyer` has no server-side
       * execute, so the turn stays suspended until this lands.
       */
      onAnswer: (toolCallId: string, value: string) =>
        assistant.addToolOutput({ output: value, tool: "askBuyer", toolCallId }),
      onApproval: assistant.addToolApprovalResponse,
      onPay: (checkout: RazorpayCheckout, orderId: string) => {
        open({
          handoff: checkout,
          /*
           * The window's outcome is told to the agent rather than acted on
           * here: whether the money moved is the verify route's answer, and
           * the agent is the one holding the conversation about it.
           */
          onSettled: (settled: boolean) =>
            sendMessage({
              text: settled
                ? `I completed the payment for order ${orderId}.`
                : `I closed the payment window for order ${orderId}. What happened?`,
            }),
          orderId,
          storeName,
        });
      },
      payingOrder: paying,
    }),
    [
      assistant.addToolApprovalResponse,
      assistant.addToolOutput,
      open,
      paying,
      sendMessage,
      storeName,
    ]
  );

  /* Auto-scroll follows the stream, and yields the moment you scroll up. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: entries and messages are render signals, not values read here.
  useEffect(() => {
    const node = scroller.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!(node && pinned)) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [entries, messages, pinned]);

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

  /*
   * A turn with nothing on screen yet still has to look like one. Once a part
   * has arrived it says what it is doing for itself, so this line goes.
   */
  const live = messages.at(-1);
  const waiting =
    assistant.busy && (live?.role !== "assistant" || live.parts.length === 0);

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
                    handlers={handlers}
                    messages={messages}
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

              {waiting ? (
                <p className="flex items-center gap-2 text-[13px] text-smoke">
                  <span aria-hidden className="stream-caret">
                    ▍
                  </span>
                  Thinking…
                </p>
              ) : null}

              {/*
                A turn that ended badly has to say so. The only end-of-turn
                signal is `busy` going false, and an error nobody is shown is
                an error nobody retries.
              */}
              {assistant.error && !assistant.busy ? (
                <div className="flex flex-col items-start gap-3">
                  <StatusLine
                    message={assistant.error.message}
                    state="incompatible"
                  />
                  <Pill onClick={onRetry} size="sm" variant="ghost">
                    Try again
                  </Pill>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="py-16">
              <h1 className="font-display font-semibold text-[40px] text-bone tracking-[-0.03em]">
                What are you building?
              </h1>
              <div className="mt-10">
                <ChatComposer
                  mode={mode}
                  onModeChange={assistant.setMode}
                  onSend={onSend}
                  onStop={onStop}
                  onValueChange={setDraft}
                  ref={composerRef}
                  streaming={stream.streaming || assistant.busy}
                  value={draft}
                />
              </div>
              <div className="mt-6 flex flex-wrap items-center">
                {STARTERS.map((starter, index) => (
                  <div className="flex items-center" key={starter.label}>
                    {index > 0 ? (
                      <span aria-hidden className="mx-4 h-4 w-px bg-hairline" />
                    ) : null}
                    <StarterPill
                      label={starter.label}
                      mode={starter.mode}
                      onModeChange={assistant.setMode}
                      onSend={send}
                    />
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
              onModeChange={assistant.setMode}
              onSend={onSend}
              onStop={onStop}
              onValueChange={setDraft}
              ref={composerRef}
              streaming={stream.streaming || assistant.busy}
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
  handlers: AgentTurnHandlers;
  messages: AgentMessage[];
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
  handlers,
  messages,
  onAnswer,
  onEdit,
  onExpand,
  onRevert,
  onSwap,
  onToggle,
  rows,
  stream,
}: ThreadEntryProps) {
  if (entry.kind === "agent") {
    const message = messages.find((item) => item.id === entry.messageId);

    return message ? <AgentTurn handlers={handlers} message={message} /> : null;
  }

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

/**
 * A starter row, which is a task as much as it is a sentence.
 *
 * "Compare two parts" is not a build request, so it sets the mode it means on
 * the way out — otherwise the first press of it would open the interview.
 */
function StarterPill({
  label,
  mode,
  onModeChange,
  onSend,
}: {
  label: string;
  mode: ChatModeId;
  onModeChange: (mode: ChatModeId) => void;
  onSend: (value: string, mode: ChatModeId) => void;
}) {
  const handleClick = useCallback(() => {
    onModeChange(mode);
    onSend(label, mode);
  }, [label, mode, onModeChange, onSend]);

  return (
    <Pill className="px-0" onClick={handleClick} size="sm" variant="text">
      {label}
    </Pill>
  );
}

export { ChatScreen };
