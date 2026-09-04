"use client";

import type { PageContextInput } from "@workspace/ai";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { cn } from "@workspace/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Cpu, GitCompare, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentMessage,
  AgentTurnHandlers,
  RazorpayCheckout,
} from "@/components/chat/agent-turn";
import { AgentTurn } from "@/components/chat/agent-turn";
import { BuildSurface } from "@/components/chat/build-surface";
import type { ChatModeId } from "@/components/chat/chat-composer";
import { ChatComposer } from "@/components/chat/chat-composer";
import { useRazorpay } from "@/hooks/use-razorpay";
import { useStorefrontAssistant } from "@/hooks/use-storefront-assistant";
import { buildSheetAction } from "@/lib/actions/build-sheet";
import { saveAssistantBuildAction } from "@/lib/actions/storefront";
import type { BuildSlotRow } from "@/lib/assistant/build";
import { partFor, validateBuild } from "@/lib/assistant/build";

/**
 * The full assistant: shell, empty state and the agent.
 *
 * One thing answers here now, and that is the change. This screen used to run
 * a fixed interview of five questions in the browser — fixed wording, fixed
 * order, model never consulted — and only handed a message to the agent once
 * that interview was over. So the first thing anybody did on this page was the
 * one thing the agent never saw, which is why it read as canned: the opening
 * line, the assumptions and the closing sentence were string literals a few
 * hundred lines from here.
 *
 * Every message goes to `/api/agent/chat`. The model asks its own questions
 * through `askBuyer` and they arrive in the thread as tappable rows; it
 * assembles machines through `assembleBuild`, which runs the same
 * deterministic engine the storefront's own recommendation screen does.
 *
 * That last part is the line §4 draws, and it has not moved. The model decides
 * what to ask, what to assemble and what to say about it; it does not decide
 * which socket takes which board. Choosing eight parts that fit each other is
 * safety-critical commerce validation, and it stays in code — see
 * `packages/ai/src/build-assembly.ts`.
 *
 * The sheet is written down as a real build as it changes, so when the
 * conversation continues past it the agent is looking at the same parts the
 * shopper is. See `saveAssistantBuildAction`.
 */

/** The opening rows, and the task each one actually is. */
const STARTERS: {
  blurb: string;
  icon: LucideIcon;
  label: string;
  mode: ChatModeId;
}[] = [
  {
    blurb: "A few questions, then a full parts list you can price and buy.",
    icon: Cpu,
    label: "Build me a PC",
    mode: "build",
  },
  {
    blurb: "Two parts, side by side, on the specs that decide it.",
    icon: GitCompare,
    label: "Compare two parts",
    mode: "compare",
  },
  {
    blurb: "Tell it what you have and it finds the part holding you back.",
    icon: TrendingUp,
    label: "What should I upgrade?",
    mode: "recommend",
  },
];

/** The tool whose output the sheet is drawn from. */
const ASSEMBLE_PART = "tool-assembleBuild";

/** The tool the model asks questions with, for the progress dots. */
const ASK_PART = "tool-askBuyer";

/** How many questions the dots imply before any have been asked. */
const EXPECTED_QUESTIONS = 4;

interface ToolPartLike {
  output?: { slots?: unknown[] };
  state: string;
  type: string;
}

/**
 * The most recent assembled build in the thread, if there is one.
 *
 * The last one wins: a shopper who says "try it at ₹60,000" gets a second
 * `assembleBuild` call, and the sheet should show the machine they just asked
 * for rather than the one before it.
 */
function latestAssembly(messages: AgentMessage[]): unknown[] | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    for (let at = message.parts.length - 1; at >= 0; at -= 1) {
      const part = message.parts[at] as ToolPartLike | undefined;

      if (
        part?.type === ASSEMBLE_PART &&
        part.state === "output-available" &&
        Array.isArray(part.output?.slots)
      ) {
        return part.output.slots;
      }
    }
  }

  return null;
}

/** Every question the model has asked, and how many have been answered. */
function questionProgress(messages: AgentMessage[]) {
  let asked = 0;
  let answered = 0;

  for (const message of messages) {
    for (const part of message.parts as ToolPartLike[]) {
      if (part.type !== ASK_PART) {
        continue;
      }

      asked += 1;

      if (part.state === "output-available") {
        answered += 1;
      }
    }
  }

  return { answered, asked };
}

interface ChatScreenProps {
  /** The store this assistant shops in, for the agent endpoint. */
  slug: string;
  /** Shown on the payment window, which is the shopper's own bank statement. */
  storeName: string;
}

function ChatScreen({ slug, storeName }: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState(true);
  const [rows, setRows] = useState<BuildSlotRow[]>([]);
  const [basis, setBasis] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);

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

  const started = messages.length > 0;

  /*
   * The sheet, drawn from whatever the agent last assembled.
   *
   * Keyed on the slots themselves rather than a message id: a re-render must
   * not redraw a sheet the shopper has since unticked rows on, and an
   * identical assembly is the same sheet whichever turn produced it.
   */
  const assembly = useMemo(() => latestAssembly(messages), [messages]);
  const drawn = useRef<string | null>(null);

  useEffect(() => {
    if (!assembly) {
      return;
    }

    const signature = JSON.stringify(assembly);

    if (signature === drawn.current) {
      return;
    }

    drawn.current = signature;

    buildSheetAction(assembly)
      .then((sheet) => {
        if (sheet.length === 0) {
          return;
        }

        setRows(sheet);
        setDocked(false);
      })
      .catch(() => {
        /*
         * Quiet on purpose. The model's own description of the build is
         * already in the thread and is still true; a toast about a widget that
         * could not be drawn is an alarm about something nobody can act on.
         */
      });
  }, [assembly]);

  /* What the sheet says it was built on, straight from the tool. */
  useEffect(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const part = messages[index]?.parts.find(
        (entry) =>
          (entry as ToolPartLike).type === ASSEMBLE_PART &&
          (entry as ToolPartLike).state === "output-available"
      ) as { output?: { basis?: string } } | undefined;

      if (part?.output?.basis) {
        setBasis(part.output.basis);

        return;
      }
    }
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
         * browser. So this is quiet on purpose.
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

  /**
   * Where a message goes: to the agent, always.
   *
   * There is no branch here any more, and its absence is the point. The
   * composer never disables itself and never diverts — you can ignore a
   * question on screen and say what you actually want, and the model gets it.
   */
  const send = useCallback(
    (text: string, task: ChatModeId) => {
      const said = text.trim();

      if (!said) {
        return;
      }

      setDraft("");

      /*
       * Carrying on past a build docks the sheet rather than rebuilding it.
       * The agent works on the saved copy from here, so a swap it makes and a
       * swap the shopper makes are edits to the same build.
       */
      if (rows.length > 0) {
        setDocked(true);
      }

      sendMessage({ text: said }, { mode: task });
    },
    [rows.length, sendMessage]
  );

  const mode = assistant.mode ?? "build";

  const onSend = useCallback(() => send(draft, mode), [draft, mode, send]);

  const onStop = useCallback(() => assistant.stop(), [assistant]);

  /** Runs the failed turn again. Wrapped so the click event is not an option. */
  const onRetry = useCallback(() => {
    assistant.regenerate();
  }, [assistant]);

  const onEditLast = useCallback(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (message?.role !== "user") {
        continue;
      }

      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as unknown as { text: string }).text)
        .join("\n");

      if (text) {
        setDraft(text);

        return;
      }
    }
  }, [messages]);

  const handlers = useMemo<AgentTurnHandlers>(
    () => ({
      /*
       * The buyer's tap *is* the tool's output — `askBuyer` has no server-side
       * execute, so the turn stays suspended until this lands.
       */
      onAnswer: (toolCallId: string, value: string) =>
        assistant.addToolOutput({
          output: value,
          tool: "askBuyer",
          toolCallId,
        }),
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages and rows are render signals, not values read here.
  useEffect(() => {
    const node = scroller.current;

    // biome-ignore lint/suspicious/noUnnecessaryConditions: ref.current is null before mount
    if (!(node && pinned)) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages, rows, pinned]);

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

  const progress = useMemo(() => questionProgress(messages), [messages]);

  /*
   * A turn with nothing on screen yet still has to look like one. Once a part
   * has arrived — reasoning included — it says what it is doing for itself.
   */
  const live = messages.at(-1);
  const waiting =
    assistant.busy && (live?.role !== "assistant" || live.parts.length === 0);

  const verdict = rows.length > 0 ? validateBuild(rows) : null;

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
              {messages.map((message) => (
                <div className="chat-turn" key={message.id}>
                  <AgentTurn handlers={handlers} message={message} />
                </div>
              ))}

              {/*
                The sheet lives after the thread rather than inside a turn.
                It is one object that the conversation edits — docking it and
                re-drawing it in place is what makes a second assembly read as
                the same machine changing rather than a new one appearing.
              */}
              {verdict && basis ? (
                <div className="chat-turn">
                  <BuildSurface
                    basis={basis}
                    docked={docked}
                    onExpand={onExpand}
                    onRevert={onRevert}
                    onSwap={onSwap}
                    onToggle={onToggle}
                    rows={rows}
                    verdict={verdict}
                  />
                </div>
              ) : null}

              {waiting ? (
                <p className="t-body-sm flex items-center gap-2 text-smoke">
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
              <div className="flex items-center gap-2.5">
                {/* The one red at rest: it says the thing is actually live. */}
                <span
                  aria-hidden
                  className="size-[6px] rounded-full bg-lacquer"
                />
                <p className="t-label text-smoke">The assistant</p>
              </div>

              <h1 className="t-display-lg mt-4 text-bone">
                What are you building?
              </h1>
              <p className="t-body-lg mt-4 max-w-[52ch] text-smoke">
                It reads this store&rsquo;s catalogue, runs the compatibility
                rules on every part it picks, and shows the working. Nothing is
                added to your cart without you pressing something.
              </p>

              <div className="mt-9">
                <ChatComposer
                  mode={mode}
                  onModeChange={assistant.setMode}
                  onSend={onSend}
                  onStop={onStop}
                  onValueChange={setDraft}
                  ref={composerRef}
                  streaming={assistant.busy}
                  value={draft}
                />
              </div>

              {/*
                These were three text pills separated by hairlines — visually
                identical to body copy, so the page's primary actions read as
                nothing at all. They are cards now, and each one says what the
                task actually does rather than only naming it.
              */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {STARTERS.map((starter) => (
                  <StarterCard
                    blurb={starter.blurb}
                    icon={starter.icon}
                    key={starter.label}
                    label={starter.label}
                    mode={starter.mode}
                    onModeChange={assistant.setMode}
                    onSend={send}
                  />
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
              streaming={assistant.busy}
              value={draft}
            />

            <ProgressDots {...progress} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * How far through the questions we are.
 *
 * The model decides how many to ask, so unlike the fixed interview this cannot
 * know the total in advance. It shows what has actually been asked against a
 * modest expectation, and stops pretending to predict once the model has asked
 * more than that — which is honest about the one thing that changed: nobody
 * here knows what the next question will be, including this component.
 */
function ProgressDots({
  answered,
  asked,
}: {
  answered: number;
  asked: number;
}) {
  if (asked === 0) {
    return null;
  }

  const total = Math.max(asked, EXPECTED_QUESTIONS);

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            index < answered && "bg-bone",
            index >= answered &&
              index < asked &&
              "bg-transparent ring-1 ring-lacquer",
            index >= asked && "bg-hairline"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity here
          key={index}
        />
      ))}
    </div>
  );
}

/**
 * A starter row, which is a task as much as it is a sentence.
 *
 * "Compare two parts" is not a build request, so it sets the mode it means on
 * the way out — otherwise the first press of it would open a build.
 */
function StarterCard({
  blurb,
  icon: Icon,
  label,
  mode,
  onModeChange,
  onSend,
}: {
  blurb: string;
  icon: LucideIcon;
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
    <button
      className="surface-card group flex h-full flex-col rounded-[20px] border border-hairline bg-panel p-5 text-left transition-[transform,border-color] duration-micro hover:-translate-y-0.5 hover:border-smoke"
      onClick={handleClick}
      type="button"
    >
      <Icon
        aria-hidden
        className="size-[18px] text-smoke transition-colors duration-micro group-hover:text-bone"
      />
      <span className="t-body mt-4 font-medium text-bone">{label}</span>
      <span className="t-body-sm mt-2 text-smoke">{blurb}</span>
    </button>
  );
}

export { ChatScreen };
