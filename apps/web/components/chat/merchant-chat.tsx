"use client";

import { useChat } from "@ai-sdk/react";
import type { MerchantMessage } from "@workspace/ai";
import { Button } from "@workspace/ui/components/button";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useRef, useState } from "react";
import { humanizeAction } from "@/lib/format";
import { ApprovalCard } from "./cards";
import { ErrorCard, ToolCard, ToolStatus } from "./primitives";

/**
 * The merchant's assistant.
 *
 * Same approval mechanics as the storefront: approving an agent order or
 * activating a campaign both move money, so both stop for the merchant.
 */

const SUGGESTIONS = [
  "How is the store doing?",
  "What isn't selling?",
  "Any orders waiting for me?",
];

export function MerchantChat({ merchantId }: { merchantId: string }) {
  const conversationId = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");

  const { addToolApprovalResponse, messages, sendMessage, status } =
    useChat<MerchantMessage>({
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
      transport: new DefaultChatTransport({
        api: "/api/agent/merchant",
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
            merchantId,
            messages: outgoing,
          },
        }),
      }),
    });

  const busy = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3 py-6">
            <p className="text-muted-foreground text-sm">
              Ask about the business. I pull the numbers before I answer, and I
              never activate anything without you.
            </p>
            <div className="flex flex-wrap gap-2">
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
              <MerchantPart
                key={`${message.id}-${index}`}
                onApproval={addToolApprovalResponse}
                part={part}
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
          placeholder="Ask about your store…"
          value={input}
        />
        <Button disabled={busy || !input.trim()} type="submit">
          Send
        </Button>
      </form>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function MerchantPart({
  onApproval,
  part,
  role,
}: {
  onApproval: (response: { approved: boolean; id: string }) => void;
  part: MerchantMessage["parts"][number];
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
    output?: any;
    state: string;
    type: string;
  };

  if (tool.state === "approval-requested" && !tool.approval?.isAutomatic) {
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
          You declined that, so nothing changed.
        </p>
      </ToolCard>
    );
  }

  if (tool.state === "output-error") {
    return <ErrorCard message={tool.errorText ?? "Something went wrong."} />;
  }

  if (tool.state !== "output-available" || !tool.output) {
    return tool.state === "input-available" ? (
      <ToolStatus>Pulling the numbers…</ToolStatus>
    ) : null;
  }

  return <MerchantToolOutput output={tool.output} type={tool.type} />;
}

function MerchantToolOutput({ output, type }: { output: any; type: string }) {
  switch (type) {
    case "tool-getSalesSummary":
      return (
        <ToolCard title={`Last ${output.windowDays} days`}>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Revenue" value={output.revenue} />
            <Stat label="Paid orders" value={String(output.paidOrders)} />
            <Stat label="Avg order" value={output.averageOrderValue} />
            <Stat label="Units" value={String(output.unitsSold)} />
          </dl>
          {output.pendingAgentOrders > 0 ? (
            <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
              {output.pendingAgentOrders} agent order(s) waiting on your
              approval.
            </p>
          ) : null}
        </ToolCard>
      );

    case "tool-findSlowMovers":
      return (
        <ToolCard title="Not selling">
          <ul className="space-y-1">
            {(output.products ?? []).map((product: any) => (
              <li
                className="flex justify-between gap-2"
                key={product.productId}
              >
                <span>{product.name}</span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {product.unitsSold} sold · {product.stock} in stock ·{" "}
                  {product.tiedUpCapital} tied up
                </span>
              </li>
            ))}
          </ul>
        </ToolCard>
      );

    case "tool-getAttachRate":
      return (
        <ToolCard title="Bought together">
          <ul className="space-y-1">
            {(output.attachRates ?? []).map((rate: any) => (
              <li key={`${rate.anchorProductId}-${rate.attachedProductId}`}>
                <span className="font-medium">{rate.attachRatePercent}%</span>{" "}
                <span className="text-muted-foreground">
                  of {rate.anchorName} orders also had {rate.attachedName} (
                  {rate.coOccurringOrders}/{rate.anchorOrders})
                </span>
              </li>
            ))}
          </ul>
        </ToolCard>
      );

    case "tool-getAgentOrderQueue":
      if ((output.orders ?? []).length === 0) {
        return (
          <ToolCard title="Approval queue">
            <p className="text-muted-foreground">Nothing waiting.</p>
          </ToolCard>
        );
      }

      return (
        <ToolCard title="Waiting for you" tone="warning">
          <ul className="space-y-3">
            {output.orders.map((order: any) => (
              <li key={order.orderId}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{order.items.join(", ")}</span>
                  <span className="tabular-nums">{order.total}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {order.buyerType === "ai_agent" ? "Buyer agent" : "Shopper"}{" "}
                  {order.buyerIdentifier}
                </p>
                {order.reason ? (
                  <p className="mt-1 border-border border-l-2 pl-2 text-muted-foreground text-xs italic">
                    {order.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </ToolCard>
      );

    case "tool-draftCampaign":
      if (!output.drafted) {
        return <ErrorCard message={output.error ?? "Could not draft that."} />;
      }

      return (
        <ToolCard title="Draft campaign" tone="warning">
          <p>{output.summary}</p>
          {output.note ? (
            <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">
              {output.note}
            </p>
          ) : null}
          {output.projection ? (
            <div className="mt-2 rounded-sm bg-muted/50 p-2 text-xs">
              <p className="font-medium">
                Projected: {output.projection.projectedIncrementalRevenue} from{" "}
                {output.projection.projectedUnitUplift} extra unit(s)
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {output.projection.assumptions.map((assumption: string) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </ToolCard>
      );

    case "tool-activateCampaign":
      return output.activated ? (
        <ToolCard title="Campaign live" tone="success">
          <p>{output.summary}</p>
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not activate that."} />
      );

    case "tool-approveAgentOrder":
      return output.approved ? (
        <ToolCard title="Approved" tone="success">
          <p>Order approved for {output.total}. The buyer can pay now.</p>
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not approve that."} />
      );

    case "tool-rejectAgentOrder":
      return (
        <ToolCard title="Rejected">
          <p className="text-muted-foreground">
            The order was cancelled and the reason recorded.
          </p>
        </ToolCard>
      );

    case "tool-getAuditTrail":
      return (
        <ToolCard title="Recent activity">
          <ul className="space-y-1">
            {(output.entries ?? []).map((entry: any, index: number) => (
              <li key={`${entry.action}-${index}`}>
                <span className="font-medium">
                  {humanizeAction(entry.action)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  — {entry.explanation}
                </span>
              </li>
            ))}
          </ul>
        </ToolCard>
      );

    case "tool-getTopPerformers":
      return (
        <ToolCard title="Selling well">
          <ul className="space-y-1">
            {(output.products ?? []).map((product: any) => (
              <li
                className="flex justify-between gap-2"
                key={product.productId}
              >
                <span>{product.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {product.unitsSold} sold · {product.revenue}
                </span>
              </li>
            ))}
          </ul>
        </ToolCard>
      );

    default:
      return null;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
