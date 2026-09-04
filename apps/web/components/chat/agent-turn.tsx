"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";
import { storefrontPendingLabel } from "@/components/assistant/storefront/pending-labels";
import {
  AnsweredQuestion,
  AskBuyerQuestion,
} from "@/components/chat/ask-buyer";
import { ReasoningTrail } from "@/components/chat/reasoning-trail";
import { StreamedText } from "@/components/chat/streamed-text";
import { PillLink } from "@/components/common/pill-link";
import { shellRoutes } from "@/lib/routes";

/**
 * One turn of the real agent, in this design.
 *
 * The interview and the build sheet are deterministic and stay that way — §4
 * is explicit that safety-critical commerce validation must not rest on model
 * reasoning. This is the other half of the assistant: everything a shopper
 * says that is not an answer to a question, streamed from `/api/agent/chat`.
 *
 * What a tool call becomes here is deliberately thin. The model is handed the
 * tool's output and writes the sentence about it, and that sentence is
 * grounded in rows; a second rendering of the same data is a card that can
 * disagree with the paragraph beside it. So a running tool says what it is
 * doing, a finished one draws something only where prose is not enough —
 * parts worth clicking, a cart total, a payment — and the rest stays quiet.
 *
 * The exception is approval. While that card is on screen the tool has *not*
 * run and the loop is suspended server-side: it is a gate, not a notification,
 * and a thread that failed to draw it would hang with no way forward.
 */

interface Part {
  type: string;
}

/** The model's own thinking, forwarded by `sendReasoning`. */
interface ReasoningPart extends Part {
  state?: "streaming" | "done";
  text: string;
}

export interface AgentMessage {
  id: string;
  parts: Part[];
  role: string;
}

interface ToolPart extends Part {
  approval?: { id: string; isAutomatic?: boolean; requestReason?: string };
  errorText?: string;
  // biome-ignore lint/suspicious/noExplicitAny: a tool input is a wide union, narrowed per case below.
  input?: any;
  // biome-ignore lint/suspicious/noExplicitAny: a tool output is a wide union, narrowed per case below.
  output?: any;
  state: string;
  toolCallId?: string;
}

export interface RazorpayCheckout {
  amount: number;
  currency: string;
  keyId: string;
  razorpayOrderId: string;
}

export interface AgentTurnHandlers {
  /**
   * The buyer's reply to an `askBuyer` call.
   *
   * That tool has no server-side execute: the loop is suspended until this
   * output arrives, so a question with no way to answer it hangs the turn.
   */
  onAnswer: (toolCallId: string, value: string) => void;
  onApproval: (response: { approved: boolean; id: string }) => void;
  onPay: (checkout: RazorpayCheckout, orderId: string) => void;
  /** The order whose payment window is already open, if any. */
  payingOrder: string | null;
}

/** The most parts worth naming under one answer. The rest are in the prose. */
const NAMED_PARTS = 4;

function isToolPart(part: Part): part is ToolPart {
  return part.type.startsWith("tool-");
}

function textOf(part: Part): string {
  return (part as unknown as { text: string }).text;
}

/** A quiet line for work in progress. Nothing here spins. */
function WorkingLine({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-smoke">
      <span aria-hidden className="stream-caret">
        ▍
      </span>
      {label}
    </p>
  );
}

/**
 * Parts the agent named, as rows you can open.
 *
 * The model says which one it would pick and why; this exists so that sentence
 * has something to point at. The price is the store's, not the model's.
 */
function NamedProducts({
  products,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: the tool's product shape, as it arrives.
  products: any[];
}) {
  const named = products.slice(0, NAMED_PARTS);

  if (named.length === 0) {
    return null;
  }

  return (
    <div className="border-hairline border-t">
      {named.map((product) => (
        <PillLink
          className="flex h-auto w-full items-center gap-3 rounded-none border-hairline border-b py-3"
          href={shellRoutes.product(String(product.id))}
          key={String(product.id)}
          size="sm"
          variant="text"
        >
          <span className="min-w-0 flex-1 truncate text-left text-[13px] text-bone">
            {product.name}
          </span>
          <span className="font-mono text-[13px] text-bone tabular-nums">
            {formatPaise(Number(product.pricePaise ?? 0))}
          </span>
          <span aria-hidden>→</span>
        </PillLink>
      ))}
    </div>
  );
}

/**
 * The gate in front of anything that spends money.
 *
 * Until one of these two is pressed the tool has not run. The reason shown is
 * the agent's own, in its words rather than restated in ours.
 */
function ApprovalGate({
  onApproval,
  part,
}: {
  onApproval: AgentTurnHandlers["onApproval"];
  part: ToolPart;
}) {
  const id = part.approval?.id ?? "";
  const approve = useCallback(
    () => onApproval({ approved: true, id }),
    [id, onApproval]
  );
  const deny = useCallback(
    () => onApproval({ approved: false, id }),
    [id, onApproval]
  );

  return (
    <div className="rounded-[20px] border border-hairline bg-panel px-5 py-4">
      <Label>Needs your say-so</Label>
      <p className="mt-2 text-[15px] text-bone leading-relaxed">
        {part.approval?.requestReason ??
          "This one spends money, so it waits for you."}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <Pill onClick={approve} size="sm">
          Approve
        </Pill>
        <Pill onClick={deny} size="sm" variant="text">
          Not now
        </Pill>
      </div>
    </div>
  );
}

/** The cart, after the agent changed it. A number, and the way to check it. */
function CartLine({ output }: { output: ToolPart["output"] }) {
  const lines: unknown[] = output?.lines ?? [];
  const count = lines.length || Number(output?.lineCount ?? 0);

  return (
    <div className="flex items-center gap-4 border-hairline border-t border-b py-3.5">
      <span className="flex-1 text-[13px] text-bone">
        {count === 1 ? "1 line in the cart" : `${count} lines in the cart`}
      </span>
      <span className="font-mono text-[13px] text-bone tabular-nums">
        {formatPaise(Number(output?.subtotalPaise ?? 0))}
      </span>
      <PillLink href={shellRoutes.cart} size="sm" variant="text">
        Open cart →
      </PillLink>
    </div>
  );
}

/**
 * An order the agent created.
 *
 * Nothing is charged at this point, and the card says so by what it offers: a
 * payment window when the order is payable, and the plain fact that it is
 * waiting when it is not.
 */
function OrderLine({
  handlers,
  output,
}: {
  handlers: AgentTurnHandlers;
  output: ToolPart["output"];
}) {
  const orderId = String(output?.orderId ?? "");
  const checkout: RazorpayCheckout | null = output?.checkout ?? null;
  const totalPaise = Number(output?.totalPaise ?? 0);
  const paying = handlers.payingOrder === orderId;
  const { onPay } = handlers;

  const pay = useCallback(() => {
    if (checkout) {
      onPay(checkout, orderId);
    }
  }, [checkout, onPay, orderId]);

  return (
    <div className="rounded-[20px] border border-hairline bg-panel px-5 py-4">
      <Label>Order</Label>
      <p className="mt-2 font-mono text-[21px] text-bone tabular-nums">
        {formatPaise(totalPaise)}
      </p>
      <p className="mt-2 text-[15px] text-smoke leading-relaxed">
        {output?.message ?? "Nothing has been charged."}
      </p>
      {checkout ? (
        <Pill className="mt-4" disabled={paying} onClick={pay} size="sm">
          {paying ? "Working…" : `Pay ${formatPaise(totalPaise)}`}
        </Pill>
      ) : null}
    </div>
  );
}

/** A finished tool call, where finishing is worth drawing. */
function ToolResult({
  handlers,
  part,
}: {
  handlers: AgentTurnHandlers;
  part: ToolPart;
}) {
  const { output } = part;

  switch (part.type) {
    case "tool-searchProducts":
      return <NamedProducts products={output.products ?? []} />;

    case "tool-suggestUpsell":
      return <NamedProducts products={output.suggestions ?? []} />;

    case "tool-addToCart":
    case "tool-addBuildToCart":
    case "tool-removeFromCart":
      return <CartLine output={output} />;

    case "tool-createOrder":
      return <OrderLine handlers={handlers} output={output} />;

    case "tool-createPaymentLink":
      return (
        <a
          className="text-[15px] text-lacquer underline underline-offset-4"
          href={String(output.paymentLinkUrl ?? "")}
          rel="noreferrer"
          target="_blank"
        >
          Open the payment page
        </a>
      );

    default:
      /* Narrated by the model, and better in its words than in a second box. */
      return null;
  }
}

/**
 * A question from the model, and the answer once given.
 *
 * Both states are drawn here rather than left to `ToolResult`, because unlike
 * every other tool this one is not a thing that happened — it is a thing the
 * turn is waiting on. Falling through to the generic pending line would show
 * "Thinking…" against a question nobody can answer, forever.
 */
function AskBuyerLine({
  handlers,
  part,
}: {
  handlers: AgentTurnHandlers;
  part: ToolPart;
}) {
  const callId = part.toolCallId ?? "";
  const { onAnswer } = handlers;

  const answer = useCallback(
    (value: string) => onAnswer(callId, value),
    [callId, onAnswer]
  );

  if (part.state === "output-available") {
    return (
      <AnsweredQuestion
        label={String(part.input?.label ?? "Answer")}
        value={String(part.output ?? "")}
      />
    );
  }

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <AskBuyerQuestion input={part.input ?? {}} onAnswer={answer} />;
  }

  return null;
}

function ToolLine({
  handlers,
  part,
}: {
  handlers: AgentTurnHandlers;
  part: ToolPart;
}) {
  if (part.type === "tool-askBuyer") {
    return <AskBuyerLine handlers={handlers} part={part} />;
  }

  if (part.state === "approval-requested") {
    return part.approval?.isAutomatic ? (
      <WorkingLine label="Checking the store's policy…" />
    ) : (
      <ApprovalGate onApproval={handlers.onApproval} part={part} />
    );
  }

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <WorkingLine label={storefrontPendingLabel(part.type)} />;
  }

  if (part.state === "output-denied") {
    return (
      <p className="text-[13px] text-smoke">
        You declined that, so nothing happened.
      </p>
    );
  }

  if (part.state === "output-error") {
    return (
      <StatusLine
        message={part.errorText ?? "That step did not go through."}
        state="incompatible"
      />
    );
  }

  if (part.state !== "output-available" || !part.output) {
    return null;
  }

  return <ToolResult handlers={handlers} part={part} />;
}

/**
 * One message from the agent, or the shopper's own words back.
 *
 * The shopper's line is drawn from the same message list rather than pushed
 * into the thread separately, so a turn the SDK sends on its own — the
 * continuation after an approval — cannot be rendered twice or missed.
 */
export function AgentTurn({
  handlers,
  message,
}: {
  handlers: AgentTurnHandlers;
  message: AgentMessage;
}) {
  if (message.role === "user") {
    return (
      <p className="pl-16 text-right text-[17px] text-smoke">
        {message.parts
          .filter((part) => part.type === "text")
          .map((part) => textOf(part))
          .join("\n")}
      </p>
    );
  }

  return (
    <div className="flex gap-3">
      <Sparkles aria-hidden className="mt-1.5 size-4 shrink-0 text-smoke" />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;

          if (part.type === "reasoning") {
            const reasoning = part as ReasoningPart;

            return (
              <ReasoningTrail
                key={key}
                /*
                 * The part's own state, not the turn's. Reasoning ends well
                 * before the turn does — tools run after it — and reading
                 * `busy` here would leave the live view open, scrolling an
                 * unchanging block, for the rest of the turn.
                 */
                streaming={reasoning.state !== "done"}
                text={reasoning.text}
              />
            );
          }

          if (part.type === "text") {
            const text = textOf(part);

            return (
              <StreamedText
                /*
                 * Pre-wrap because the model writes in lines: a short list or
                 * a two-column table arrives with newlines in it, and collapsed
                 * whitespace turns that into one unreadable run of pipes.
                 */
                className="whitespace-pre-wrap text-[17px] leading-relaxed"
                id={key}
                key={key}
                /*
                 * Every word the model has sent is shown: the reveal is the
                 * network's cadence rather than a timer's, and running a
                 * second clock over a stream that already arrives a token at a
                 * time only makes the answer later than it is.
                 */
                shown={text.split(" ").length}
                streaming={false}
                text={text}
              />
            );
          }

          return isToolPart(part) ? (
            <ToolLine handlers={handlers} key={key} part={part} />
          ) : null;
        })}
      </div>
    </div>
  );
}
