"use client";

import { useChat } from "@ai-sdk/react";
import type { StorefrontMessage } from "@workspace/ai";
import { Button } from "@workspace/ui/components/button";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { formatPaise } from "@/lib/format";
import {
  ApprovalCard,
  FailureCard,
  OrderCard,
  PaymentLinkCard,
  ProductGrid,
  QuoteCard,
  RecommendationCard,
} from "./cards";
import { ErrorCard, ToolCard, ToolStatus } from "./primitives";

/**
 * The buyer-facing chat.
 *
 * Structured tool output is rendered as cards rather than dumped as JSON, and
 * every money action arrives as an explicit approval card. The card is not
 * decoration: until the buyer answers it, the agent loop is suspended
 * server-side and the tool has not run.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface CheckoutHandoff {
  amount: number;
  currency: string;
  keyId: string;
  razorpayOrderId: string;
}

const SUGGESTIONS = [
  "I need a graphics card for 1440p gaming under ₹30,000",
  "Is this GPU going to fit my case?",
  "Build me a gaming PC for ₹80,000",
];

export function StorefrontChat({
  slug,
  storeName,
}: {
  slug: string;
  storeName: string;
}) {
  const conversationId = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [payingOrder, setPayingOrder] = useState<string | null>(null);

  const { addToolApprovalResponse, messages, sendMessage, status } =
    useChat<StorefrontMessage>({
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
      transport: new DefaultChatTransport({
        api: "/api/agent/chat",
        // The conversation id comes back on a response header so one shopping
        // session stays one thread in the audit trail.
        fetch: async (input_, init) => {
          const response = await fetch(input_, init);
          const id = response.headers.get("x-conversation-id");

          if (id) {
            conversationId.current = id;
          }

          return response;
        },
        prepareSendMessagesRequest: ({ messages: outgoing }) => ({
          body: {
            conversationId: conversationId.current,
            messages: outgoing,
            slug,
          },
        }),
      }),
    });

  /** Opens Razorpay Checkout and settles the order against our verify route. */
  const openCheckout = useCallback(
    (checkout: CheckoutHandoff, orderId: string) => {
      if (!window.Razorpay) {
        return;
      }

      setPayingOrder(orderId);

      const razorpay = new window.Razorpay({
        amount: checkout.amount,
        currency: checkout.currency,
        handler: async (response: Record<string, string>) => {
          await fetch("/api/payments/verify", {
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });

          setPayingOrder(null);
          sendMessage({
            text: `I completed the payment for order ${orderId}.`,
          });
        },
        key: checkout.keyId,
        modal: {
          ondismiss: () => {
            setPayingOrder(null);
            sendMessage({
              text: `I closed the payment window for order ${orderId}. What happened?`,
            });
          },
        },
        name: storeName,
        order_id: checkout.razorpayOrderId,
      });

      razorpay.open();
    },
    [sendMessage, storeName]
  );

  const busy = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-full flex-col">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Tell me what you need and I&apos;ll find it. I&apos;ll always show
              you the full price before anything is ordered.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  onClick={() => sendMessage({ text: suggestion })}
                  size="xs"
                  variant="outline"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div className="space-y-2" key={message.id}>
            {message.parts.map((part, index) => (
              <MessagePart
                key={`${message.id}-${index}`}
                onApproval={addToolApprovalResponse}
                onPay={openCheckout}
                onSend={(text) => sendMessage({ text })}
                part={part}
                payingOrder={payingOrder}
                role={message.role}
              />
            ))}
          </div>
        ))}

        {busy ? <ToolStatus>Thinking…</ToolStatus> : null}
      </div>

      <form
        className="flex gap-2 border-border border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
      >
        <input
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          onChange={(event) => setInput(event.target.value)}
          placeholder="What are you looking for?"
          value={input}
        />
        <Button disabled={busy || !input.trim()} type="submit">
          Send
        </Button>
      </form>
    </div>
  );
}

/** Renders one message part — text, or a typed tool part with its own card. */
function MessagePart({
  onApproval,
  onPay,
  onSend,
  part,
  payingOrder,
  role,
}: {
  onApproval: (response: { approved: boolean; id: string }) => void;
  onPay: (checkout: CheckoutHandoff, orderId: string) => void;
  onSend: (text: string) => void;
  // The union of tool parts is wide; each branch narrows before reading.
  part: StorefrontMessage["parts"][number];
  payingOrder: string | null;
  role: string;
}) {
  if (part.type === "text") {
    return (
      <p
        className={
          role === "user"
            ? "ml-auto w-fit max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
            : "whitespace-pre-wrap text-sm leading-relaxed"
        }
      >
        {part.text}
      </p>
    );
  }

  if (!part.type.startsWith("tool-")) {
    return null;
  }

  const tool = part as unknown as {
    approval?: { id: string; isAutomatic?: boolean; requestReason?: string };
    errorText?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    state: string;
    toolCallId: string;
    type: string;
  };

  if (tool.state === "approval-requested") {
    if (tool.approval?.isAutomatic) {
      return <ToolStatus>Checking policy…</ToolStatus>;
    }

    return (
      <ApprovalCard
        onApprove={() =>
          onApproval({ approved: true, id: tool.approval?.id ?? "" })
        }
        onDeny={() =>
          onApproval({ approved: false, id: tool.approval?.id ?? "" })
        }
        reason={tool.approval?.requestReason}
      />
    );
  }

  if (tool.state === "output-denied") {
    return (
      <ToolCard title="Not done">
        <p className="text-muted-foreground">
          You declined that, so nothing happened.
        </p>
      </ToolCard>
    );
  }

  if (tool.state === "output-error") {
    return <ErrorCard message={tool.errorText ?? "Something went wrong."} />;
  }

  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return <ToolStatus>{describePending(tool.type)}</ToolStatus>;
  }

  if (tool.state !== "output-available" || !tool.output) {
    return null;
  }

  return (
    <ToolOutput
      input={tool.input}
      onPay={onPay}
      onSend={onSend}
      output={tool.output}
      payingOrder={payingOrder}
      type={tool.type}
    />
  );
}

function describePending(type: string): string {
  switch (type) {
    case "tool-searchProducts":
      return "Searching the catalog…";
    case "tool-quoteOrder":
      return "Pricing your cart…";
    case "tool-createOrder":
      return "Creating the order…";
    case "tool-suggestUpsell":
      return "Checking what pairs with this…";
    case "tool-getOrderStatus":
      return "Checking the order…";
    default:
      return "Working…";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ToolOutput({
  input,
  onPay,
  onSend,
  output,
  payingOrder,
  type,
}: {
  input: any;
  onPay: (checkout: CheckoutHandoff, orderId: string) => void;
  onSend: (text: string) => void;
  output: any;
  payingOrder: string | null;
  type: string;
}) {
  switch (type) {
    case "tool-searchProducts":
      return (
        <ProductGrid
          note={
            output.strategy === "lexical" ? "Matched on keywords." : undefined
          }
          products={output.products ?? []}
          title="From the catalog"
        />
      );

    case "tool-suggestUpsell":
      return (
        <ProductGrid
          note={output.note}
          products={output.suggestions ?? []}
          title="Often bought together"
        />
      );

    case "tool-recommendProducts":
      // The reasons and confidences live on the tool's input, not its output —
      // the output only confirms how many were written to the record.
      return (
        <RecommendationCard recommendations={input?.recommendations ?? []} />
      );

    case "tool-quoteOrder":
      return <QuoteCard quote={output} />;

    case "tool-createOrder":
      return (
        <OrderCard
          approvalStatus={output.approvalStatus}
          breakdown={output.breakdown}
          message={output.message}
          onPay={
            output.checkout
              ? () => onPay(output.checkout, output.orderId)
              : undefined
          }
          orderId={output.orderId}
          payable={Boolean(output.checkout) && payingOrder !== output.orderId}
          totalPaise={output.totalPaise}
        />
      );

    case "tool-createPaymentLink":
      return (
        <PaymentLinkCard message={output.message} url={output.paymentLinkUrl} />
      );

    case "tool-getOrderStatus":
      if (output.paymentStatus === "failed") {
        return (
          <FailureCard
            failureReason={output.failureReason}
            onOption={(option) => onSend(`Let's ${option}.`)}
            options={output.recoveryOptions ?? []}
          />
        );
      }

      return (
        <ToolCard title="Order status">
          <p>
            {output.orderStatus} · {output.approvalStatus} ·{" "}
            {formatPaise(output.totalPaise)}
          </p>
        </ToolCard>
      );

    case "tool-cancelOrder":
      return (
        <ToolCard title="Cancelled">
          <p className="text-muted-foreground">{output.message}</p>
        </ToolCard>
      );

    default:
      return null;
  }
}
