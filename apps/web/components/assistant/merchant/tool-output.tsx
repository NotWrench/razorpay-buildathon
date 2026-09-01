"use client";

import { humanizeAction } from "@/lib/format";
import { ErrorCard, ToolCard } from "../primitives";
import type { ToolPartShape } from "../tool-part";
import { Stat } from "./stat";

/**
 * A finished merchant tool call, as a card.
 *
 * The operations agent's answers are mostly numbers, and a number the merchant
 * cannot trace is a number they will not act on — so each card names the
 * window it covers and the counts behind the ratio it quotes.
 */

/* biome-ignore lint/suspicious/noExplicitAny: tool outputs are a wide union narrowed per case. */
type Output = any;

export function MerchantToolOutput({ part }: { part: ToolPartShape }) {
  const output = part.output as Output;

  switch (part.type) {
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
        <ProductLines
          describe={(product: Output) =>
            `${product.unitsSold} sold · ${product.stock} in stock · ${product.tiedUpCapital} tied up`
          }
          rows={output.products ?? []}
          title="Not selling"
        />
      );

    case "tool-getTopPerformers":
      return (
        <ProductLines
          describe={(product: Output) =>
            `${product.unitsSold} sold · ${product.revenue}`
          }
          rows={output.products ?? []}
          title="Selling well"
        />
      );

    case "tool-getAttachRate":
      return (
        <ToolCard title="Bought together">
          <ul className="space-y-1">
            {(output.attachRates ?? []).map((rate: Output) => (
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
      return <AgentQueueCard orders={output.orders ?? []} />;

    case "tool-draftCampaign":
      if (!output.drafted) {
        return <ErrorCard message={output.error ?? "Could not draft that."} />;
      }

      return <CampaignDraftCard draft={output} />;

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
            {(output.entries ?? []).map((entry: Output) => (
              <li key={`${entry.action}-${entry.explanation}`}>
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

    default:
      return null;
  }
}

function ProductLines({
  describe,
  rows,
  title,
}: {
  describe: (row: Output) => string;
  rows: Output[];
  title: string;
}) {
  if (rows.length === 0) {
    return (
      <ToolCard title={title}>
        <p className="text-muted-foreground">Nothing to report.</p>
      </ToolCard>
    );
  }

  return (
    <ToolCard title={title}>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li className="flex justify-between gap-2" key={row.productId}>
            <span>{row.name}</span>
            <span className="whitespace-nowrap text-muted-foreground tabular-nums">
              {describe(row)}
            </span>
          </li>
        ))}
      </ul>
    </ToolCard>
  );
}

function AgentQueueCard({ orders }: { orders: Output[] }) {
  if (orders.length === 0) {
    return (
      <ToolCard title="Approval queue">
        <p className="text-muted-foreground">Nothing waiting.</p>
      </ToolCard>
    );
  }

  return (
    <ToolCard title="Waiting for you" tone="warning">
      <ul className="space-y-3">
        {orders.map((order) => (
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
}

function CampaignDraftCard({ draft }: { draft: Output }) {
  return (
    <ToolCard title="Draft campaign" tone="warning">
      <p>{draft.summary}</p>
      {draft.note ? (
        <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">
          {draft.note}
        </p>
      ) : null}
      {draft.projection ? (
        <div className="mt-2 rounded-sm bg-muted/50 p-2 text-xs">
          <p className="font-medium">
            Projected: {draft.projection.projectedIncrementalRevenue} from{" "}
            {draft.projection.projectedUnitUplift} extra unit(s)
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
            {draft.projection.assumptions.map((assumption: string) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </ToolCard>
  );
}
