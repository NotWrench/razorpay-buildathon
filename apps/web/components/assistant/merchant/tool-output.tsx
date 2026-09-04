"use client";

import { formatPaise, humanizeAction } from "@/lib/format";
import { ErrorCard, ToolCard } from "../primitives";
import type { ToolPartShape } from "../tool-part";
import { Stat } from "./stat";

/**
 * A finished merchant tool call, as a card.
 *
 * The operations agent's answers are mostly numbers, and a number the merchant
 * cannot trace is a number they will not act on — so each card names the
 * window it covers and the counts behind the ratio it quotes.
 *
 * Every tool that returns something a merchant would act on has a card. A tool
 * that renders nothing is worse than it sounds: the agent calls it, uses the
 * figures in its prose, and the merchant is asked to take the arithmetic on
 * trust because the evidence never reached the screen. The `assumptions` and
 * `note` fields several of these tools return are rendered for the same
 * reason — they are the part the merchant is supposed to be able to argue
 * with.
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
          title={`Not selling · last ${output.windowDays} days`}
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

    case "tool-getDiscountCandidates":
      return (
        <ProductLines
          assumptions={output.assumptions}
          describe={(product: Output) =>
            `${product.unitsSold} sold · ${product.stock} on hand · ${formatPaise(product.stockValuePaise)} tied up`
          }
          rows={output.candidates ?? []}
          title={`Worth discounting · last ${output.windowDays} days`}
        />
      );

    case "tool-getDiscontinueCandidates":
      return (
        <ProductLines
          assumptions={output.assumptions}
          describe={(product: Output) =>
            `${formatPaise(product.revenuePaise)} in ${output.windowDays} days · ${product.stock} on hand`
          }
          rows={output.candidates ?? []}
          title="Review for discontinuation"
        />
      );

    case "tool-getReorderCandidates":
      return (
        <ProductLines
          assumptions={output.assumptions}
          describe={(product: Output) =>
            `${product.stock} left · ${product.daysOfCover}d cover · order ${product.suggestedQuantity}`
          }
          rows={output.candidates ?? []}
          title={`Worth reordering · last ${output.windowDays} days`}
        />
      );

    case "tool-getStockRisk":
      return (
        <ProductLines
          assumptions={output.assumptions}
          describe={(product: Output) =>
            `${product.stock} left · ${describeCover(product)}`
          }
          rows={output.products ?? []}
          title={
            output.count === 0
              ? "Nothing at risk of stocking out"
              : `${output.count} at risk of stocking out`
          }
          tone={output.count > 0 ? "warning" : "neutral"}
        />
      );

    case "tool-getLowStockProducts":
      return (
        <ProductLines
          describe={(product: Output) =>
            `${product.stock} left · threshold ${product.lowStockThreshold ?? "not set"}`
          }
          rows={output.products ?? []}
          title={`Low stock (${output.count})`}
          tone={output.count > 0 ? "warning" : "neutral"}
        />
      );

    case "tool-getInventorySummary":
      return (
        <ToolCard title="Stock health">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Products" value={String(output.distinctProducts)} />
            <Stat label="On hand" value={String(output.unitsOnHand)} />
            <Stat
              label="Retail value"
              value={formatPaise(output.stockValuePaise)}
            />
            <Stat
              label="Out / low"
              value={`${output.outOfStock} / ${output.belowThreshold}`}
            />
          </dl>
          {/*
            The gap is the point. A store where nothing is flagged low might be
            healthy or might have no thresholds set at all, and those are not
            the same store.
          */}
          {output.note ? (
            <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
              {output.note}
            </p>
          ) : null}
        </ToolCard>
      );

    case "tool-getOrderSummary":
      return (
        <ToolCard title={`Orders · last ${output.windowDays} days`}>
          <ul className="space-y-1">
            {(output.byStatus ?? []).map((row: Output) => (
              <li className="flex justify-between gap-2" key={row.status}>
                <span className="capitalize">{row.status}</span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {row.count} · {formatPaise(row.valuePaise)}
                </span>
              </li>
            ))}
          </ul>
          {output.pendingApproval > 0 ? (
            <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
              {output.pendingApproval} waiting on your approval.
            </p>
          ) : null}
        </ToolCard>
      );

    case "tool-getCancellationSummary":
      return (
        <ToolCard
          title={`Did not complete · last ${output.windowDays} days`}
          tone={output.cancelledOrders > 0 ? "warning" : "neutral"}
        >
          <p>
            {output.cancelledOrders} order(s),{" "}
            {formatPaise(output.valueLostPaise)} lost.
          </p>
          <ul className="mt-2 space-y-1">
            {(output.reasons ?? []).map((row: Output) => (
              <li key={row.errorType}>
                <span className="font-medium">
                  {humanizeAction(row.errorType)} × {row.count}
                </span>
                <span className="text-muted-foreground"> — {row.sample}</span>
              </li>
            ))}
          </ul>
          {/*
            No recorded reason is itself a finding. A merchant told "3 orders
            failed" and shown nothing about why will assume we know and are
            not saying, rather than that the trail is empty.
          */}
          {(output.reasons ?? []).length === 0 && output.cancelledOrders > 0 ? (
            <p className="mt-2 text-muted-foreground text-xs">
              Nothing was recorded about why — a gap in the failure trail, not
              a clean sheet.
            </p>
          ) : null}
        </ToolCard>
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

    case "tool-getCatalogReadiness":
      return <ReadinessCard readiness={output} />;

    case "tool-enrichProduct":
      return output.enriched ? (
        <ToolCard title="Catalogue updated" tone="success">
          <p>{output.summary}</p>
          {output.note ? (
            <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">
              {output.note}
            </p>
          ) : null}
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not update that."} />
      );

    case "tool-getAgentBuyerActivity":
      return <AgentBuyersCard agents={output.agents ?? []} note={output.note} />;

    case "tool-getCampaignPerformance":
      if (output.found === false) {
        return (
          <ToolCard title="Not found">
            <p className="text-muted-foreground">
              No campaign with that id in this store.
            </p>
          </ToolCard>
        );
      }

      return <CampaignResultCard result={output} />;

    case "tool-pauseCampaign":
      return output.paused ? (
        <ToolCard title="Campaign stopped">
          <p>{output.summary}</p>
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not stop that."} />
      );

    case "tool-getMarginSummary":
      return (
        <ToolCard title={`Margin · last ${output.windowDays} days`}>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Revenue" value={output.revenue} />
            <Stat label="Cost of goods" value={output.costOfGoods} />
            <Stat label="Gross margin" value={output.grossMargin} />
            <Stat
              label="Margin %"
              value={
                output.grossMarginPercent === null
                  ? "n/a"
                  : `${output.grossMarginPercent}%`
              }
            />
          </dl>
          {/*
            The coverage caveat is not a footnote. A margin computed over the
            costed half of a catalogue and read as the whole is a number that
            makes a merchant confident about the wrong thing.
          */}
          <p className="mt-2 border-border border-t pt-2 text-muted-foreground text-xs">
            {output.assumptions}
          </p>
        </ToolCard>
      );

    case "tool-getAgentOrderQueue":
      return <AgentQueueCard orders={output.orders ?? []} />;

    case "tool-draftCampaign":
      if (!output.drafted) {
        return <ErrorCard message={output.error ?? "Could not draft that."} />;
      }

      return <CampaignDraftCard draft={output} />;

    case "tool-listCampaigns":
      return (
        <ToolCard title="Campaigns">
          {(output.campaigns ?? []).length === 0 ? (
            <p className="text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {(output.campaigns ?? []).map((campaign: Output) => (
                <li className="flex justify-between gap-2" key={campaign.campaignId}>
                  <span>{campaign.title}</span>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {campaign.discountType === "percentage"
                      ? `${campaign.discountValue}% off`
                      : "flat off"}{" "}
                    · {String(campaign.status).replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
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

    case "tool-createReorderRequest":
      return output.created ? (
        <ToolCard title="Reorder requested" tone="warning">
          <p>{output.summary}</p>
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not raise that."} />
      );

    case "tool-listReorderRequests":
      return (
        <ToolCard title="Reorder requests">
          {(output.requests ?? []).length === 0 ? (
            <p className="text-muted-foreground">None raised.</p>
          ) : (
            <ul className="space-y-1">
              {(output.requests ?? []).map((request: Output) => (
                <li
                  className="flex justify-between gap-2"
                  key={request.reorderRequestId}
                >
                  <span>
                    {request.quantity} × {request.productName}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {String(request.status).replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ToolCard>
      );

    case "tool-updateInventoryThreshold":
      return output.updated ? (
        <ToolCard title="Thresholds updated" tone="success">
          <dl className="grid grid-cols-2 gap-2">
            <Stat
              label="Low stock at"
              value={String(output.settings.lowStockThreshold ?? "not set")}
            />
            <Stat
              label="Reorder point"
              value={String(output.settings.reorderPoint ?? "not set")}
            />
            <Stat
              label="Reorder qty"
              value={String(output.settings.reorderQuantity ?? "not set")}
            />
            <Stat
              label="Lead time"
              value={
                output.settings.supplierLeadTimeDays === null ||
                output.settings.supplierLeadTimeDays === undefined
                  ? "not set"
                  : `${output.settings.supplierLeadTimeDays}d`
              }
            />
          </dl>
        </ToolCard>
      ) : (
        <ErrorCard message={output.error ?? "Could not change that."} />
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

    case "tool-explainDecision":
      if (!output.found) {
        return (
          <ToolCard title="Not found">
            <p className="text-muted-foreground">
              No order with that id belongs to this store.
            </p>
          </ToolCard>
        );
      }

      return <DecisionCard decision={output} />;

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

/**
 * Cover, and whether the shelf outlasts the supplier.
 *
 * A null cover is not "forever" — it means nothing sold, which the tool keeps
 * separate on purpose: the same arithmetic produces opposite findings, and a
 * dash would leave the merchant to guess which one this is.
 */
function describeCover(product: Output): string {
  if (product.daysOfCover === null) {
    return "nothing sold";
  }

  return product.stocksOutBeforeResupply
    ? `${product.daysOfCover}d cover, under the ${product.leadTimeDays}d lead time`
    : `${product.daysOfCover}d cover`;
}

function ProductLines({
  assumptions,
  describe,
  rows,
  title,
  tone = "neutral",
}: {
  /** The tool's stated basis, when it has one. Rendered, never summarised. */
  assumptions?: string;
  describe: (row: Output) => string;
  rows: Output[];
  title: string;
  tone?: "neutral" | "warning";
}) {
  if (rows.length === 0) {
    return (
      <ToolCard title={title}>
        <p className="text-muted-foreground">Nothing to report.</p>
      </ToolCard>
    );
  }

  return (
    <ToolCard title={title} tone={tone}>
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
      {assumptions ? (
        <p className="mt-2 border-border border-t pt-2 text-muted-foreground text-xs">
          {assumptions}
        </p>
      ) : null}
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
            ) : (
              <p className="mt-1 text-destructive text-xs">
                No reason given — treat with suspicion.
              </p>
            )}
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

/**
 * How much of the catalogue an AI buyer can actually use.
 *
 * Blocking gaps are separated from cosmetic ones on the card as well as in the
 * data, because the merchant's first question is "which of these costs me
 * sales" and a flat list of complaints does not answer it.
 */
function ReadinessCard({ readiness }: { readiness: Output }) {
  return (
    <ToolCard
      title="Agent-readable catalogue"
      tone={readiness.blockedCount > 0 ? "warning" : "neutral"}
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Score" value={`${readiness.score} / 100`} />
        <Stat label="Cannot recommend" value={String(readiness.blockedCount)} />
        <Stat label="Stock exposed" value={readiness.revenueAtRisk} />
      </dl>

      <ul className="mt-3 space-y-2">
        {(readiness.products ?? []).map((product: Output) => (
          <li key={product.productId}>
            <div className="flex justify-between gap-2">
              <span className={product.blocksRecommendation ? "font-medium" : ""}>
                {product.name}
              </span>
              <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                {product.score} · {product.stockValue}
              </span>
            </div>
            <ul className="mt-0.5 list-disc pl-4 text-muted-foreground text-xs">
              {product.gaps.map((gap: string) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-border border-t pt-2 text-muted-foreground text-xs">
        {readiness.assumptions}
      </p>
    </ToolCard>
  );
}

/** The merchant's AI customers, and how often they get a yes. */
function AgentBuyersCard({
  agents,
  note,
}: {
  agents: Output[];
  note?: string;
}) {
  if (agents.length === 0) {
    return (
      <ToolCard title="Agent buyers">
        <p className="text-muted-foreground">
          {note ?? "No external agent has ordered here."}
        </p>
      </ToolCard>
    );
  }

  return (
    <ToolCard title="Agent buyers">
      <ul className="space-y-2">
        {agents.map((agent) => (
          <li key={agent.buyerIdentifier}>
            <div className="flex justify-between gap-2">
              <span className="font-mono text-xs">
                {agent.buyerIdentifier}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                {agent.committed}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {agent.totalOrders} order(s) ·{" "}
              {agent.approvalRatePercent === null
                ? "none decided yet"
                : `${agent.approvalRatePercent}% approved`}
              {agent.pendingOrders > 0
                ? ` · ${agent.pendingOrders} waiting on you`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </ToolCard>
  );
}

/** Did the campaign work — with the reason that question is hard on the card. */
function CampaignResultCard({ result }: { result: Output }) {
  const better = result.unitsChange > 0;

  return (
    <ToolCard title={result.title}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Units before" value={String(result.baseline.units)} />
        <Stat label="Units during" value={String(result.during.units)} />
        <Stat
          label="Change"
          value={`${better ? "+" : ""}${result.unitsChange}`}
        />
        <Stat label="Given away" value={result.givenAway} />
      </dl>

      <p className="mt-2 text-muted-foreground text-xs">
        {result.attributedOrders} order(s) carried this campaign's discount.
      </p>

      {/*
        The caveat is rendered, not summarised. A before-and-after read as
        proof is how a coincidence becomes a reason to do it again.
      */}
      <p className="mt-2 border-border border-t pt-2 text-muted-foreground text-xs">
        {result.caveat}
      </p>
    </ToolCard>
  );
}

/** The trail for one order, read back from the record rather than recalled. */
function DecisionCard({ decision }: { decision: Output }) {
  return (
    <ToolCard title="What happened">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Order" value={decision.order.orderStatus} />
        <Stat label="Approval" value={decision.order.approvalStatus} />
        <Stat label="Total" value={decision.order.total} />
      </dl>

      {decision.order.purchaseReason ? (
        <p className="mt-2 border-border border-l-2 pl-2 text-muted-foreground text-xs italic">
          {decision.order.purchaseReason}
        </p>
      ) : null}

      <ul className="mt-2 space-y-1 text-xs">
        {(decision.auditTrail ?? []).map((entry: Output) => (
          <li key={`${entry.at}-${entry.action}`}>
            <span className="font-medium">{humanizeAction(entry.action)}</span>
            <span className="text-muted-foreground">
              {" "}
              — {entry.actor}: {entry.explanation}
            </span>
          </li>
        ))}
      </ul>

      {(decision.failures ?? []).length > 0 ? (
        <ul className="mt-2 space-y-1 text-destructive text-xs">
          {decision.failures.map((failure: Output) => (
            <li key={failure.message}>
              {failure.type}: {failure.message}
            </li>
          ))}
        </ul>
      ) : null}
    </ToolCard>
  );
}
