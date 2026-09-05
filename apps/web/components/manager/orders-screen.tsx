"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { TypedConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import { ManagerSearch } from "@/components/manager/manager-search";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable } from "@/components/manager/manager-table";
import { useAction } from "@/hooks/use-action";
import {
  decideAgentOrderAction,
  refundOrderAction,
} from "@/lib/actions/manager";
import type { ManagerOrder, ManagerOrderState } from "@/lib/data/types";

/**
 * Orders, and the things you actually do to them.
 *
 * Still a table, because an order is six values and a column is the right
 * shape for that. What changed is that the five filters were five loose pills
 * with no sense of being one control and no idea how many orders were behind
 * each of them — they are one track now, and each segment carries its count.
 *
 * Status wears a chip so the column has an edge to scan down, but the colour
 * rule is unchanged: only the states that are not the normal course of
 * business get any — Cancelled in lacquer, Refunded and Awaiting in amber. A
 * column where every row is coloured is a column nobody reads.
 *
 * "Mark fulfilled" used to sit here and did nothing, because there is no
 * shipment anywhere in this schema for it to write to. It is gone rather than
 * backed by an invented column: a control that claims a state the database
 * cannot hold teaches the operator that the buttons on this screen are
 * decorative, which is expensive when one of them refunds money.
 *
 * What replaces it is the queue this whole system is built around. An order a
 * buying agent created sits unpaid and uncharged until a human decides, and
 * the reason the agent gave is shown in full — it is the merchant's only
 * evidence for the decision, so it is never truncated.
 */

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "awaiting", label: "Awaiting you" },
  { id: "new", label: "New" },
  { id: "due", label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
];

const STATE_WORD: Record<ManagerOrderState, string> = {
  awaiting: "Awaiting you",
  cancelled: "Cancelled",
  due: "Paid",
  new: "New",
  refunded: "Refunded",
};

const STATE_TONE: Record<ManagerOrderState, string> = {
  awaiting: "border-amber/40 text-amber",
  cancelled: "border-lacquer/40 text-lacquer",
  due: "border-hairline text-smoke",
  new: "border-smoke/40 text-bone",
  refunded: "border-amber/40 text-amber",
};

const orderKey = (order: ManagerOrder) => order.id;

function StatusChip({ state }: { state: ManagerOrderState }) {
  return (
    <span
      className={cn(
        "t-body-sm inline-flex h-7 items-center whitespace-nowrap rounded-full border px-3",
        STATE_TONE[state]
      )}
    >
      {STATE_WORD[state]}
    </span>
  );
}

function FilterSegment({
  active,
  count,
  id,
  label,
  onSelect,
}: {
  active: boolean;
  count: number;
  id: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const click = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <button
      aria-pressed={active}
      className={cn(
        "t-body-sm flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 font-medium transition-colors duration-micro",
        "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-[3px]",
        active ? "bg-bone text-void" : "text-smoke hover:text-bone"
      )}
      onClick={click}
      type="button"
    >
      {label}
      <span
        className={cn("t-num-xs", active ? "text-void/55" : "text-smoke/70")}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * What is in the order, and the things you can do about it.
 *
 * The lines carry no image — an order line is a name, a quantity and a price,
 * and there is no product record behind it to render — so this stays
 * typographic and gets its structure from a totals rule instead.
 */
function OrderLines({
  busy,
  onApprove,
  onReject,
  onRefund,
  order,
}: {
  busy: boolean;
  onApprove: (order: ManagerOrder) => void;
  onReject: (order: ManagerOrder) => void;
  onRefund: (order: ManagerOrder) => void;
  order: ManagerOrder;
}) {
  const approve = useCallback(() => onApprove(order), [onApprove, order]);
  const reject = useCallback(() => onReject(order), [onReject, order]);
  const refund = useCallback(() => onRefund(order), [onRefund, order]);

  const awaiting = order.state === "awaiting";

  return (
    <div className="max-w-[560px]">
      <Label>Items</Label>

      <dl className="mt-3">
        {order.lines.map((line) => (
          <div
            className="flex items-baseline justify-between gap-6 py-1.5"
            key={line.name}
          >
            <dt className="t-body-sm min-w-0 truncate text-bone">
              {line.quantity > 1 ? (
                <span className="font-mono text-smoke tabular-nums">
                  {line.quantity} ×{" "}
                </span>
              ) : null}
              {line.name}
            </dt>
            <dd className="t-num-xs shrink-0 text-smoke">
              {formatPaise(line.pricePaise * line.quantity)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-baseline justify-between gap-6 border-hairline border-t pt-3">
        <span className="t-num-xs text-smoke">{order.itemCount} items</span>
        <span className="t-num-sm text-bone">
          {formatPaise(order.totalPaise)}
        </span>
      </div>

      {order.buyerType === "ai_agent" ? (
        <div className="mt-5 border-hairline border-l-2 pl-4">
          <Label>Why the agent bought</Label>
          <p className="t-body-sm mt-1.5 text-smoke">
            {order.agentReason ??
              "No reason given — treat this one with suspicion."}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {awaiting ? (
          <>
            <Pill disabled={busy} onClick={approve} size="sm" variant="ghost">
              Approve
            </Pill>
            <Pill disabled={busy} onClick={reject} size="sm" variant="ghost">
              Reject
            </Pill>
          </>
        ) : null}

        {order.refundable ? (
          <Pill disabled={busy} onClick={refund} size="sm" variant="ghost">
            Refund
          </Pill>
        ) : null}

        {/*
          An order with nothing to do to it says so, rather than showing
          controls that would be refused. `refundable` comes off a captured
          payment, not off the order's own status.
        */}
        {awaiting || order.refundable ? null : (
          <p className="t-body-sm text-smoke">
            {order.state === "refunded"
              ? "Already refunded."
              : "Nothing to do — no captured payment on this order."}
          </p>
        )}
      </div>
    </div>
  );
}

function OrdersScreen({ orders }: { orders: ManagerOrder[] }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<ManagerOrder | null>(null);

  const refund = useAction(refundOrderAction, {
    onSuccess: () => setRefunding(null),
    successMessage: "Refunded. Razorpay confirmed it.",
  });

  const decide = useAction(decideAgentOrderAction);

  const counts = useMemo(() => {
    const tally = new Map<string, number>([["all", orders.length]]);

    for (const entry of orders) {
      tally.set(entry.state, (tally.get(entry.state) ?? 0) + 1);
    }

    return tally;
  }, [orders]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return orders.filter(
      (order) =>
        (filter === "all" || order.state === filter) &&
        (needle.length === 0 ||
          order.id.toLowerCase().includes(needle) ||
          order.customer.toLowerCase().includes(needle))
    );
  }, [filter, orders, query]);

  const awaitingCount = counts.get("awaiting") ?? 0;

  const onToggle = useCallback(
    (key: string) => setOpenKey((current) => (current === key ? null : key)),
    []
  );

  const showAll = useCallback(() => {
    setFilter("all");
    setQuery("");
  }, []);

  const onApprove = useCallback(
    (order: ManagerOrder) =>
      decide.run({
        decision: "approve",
        explanation: "Approved by the merchant from the orders screen.",
        orderId: order.orderId,
      }),
    [decide]
  );

  const onReject = useCallback(
    (order: ManagerOrder) =>
      decide.run({
        decision: "reject",
        explanation: "Rejected by the merchant from the orders screen.",
        orderId: order.orderId,
      }),
    [decide]
  );

  const onRefundConfirm = useCallback(() => {
    if (refunding) {
      refund.run(refunding.orderId);
    }
  }, [refund, refunding]);

  const onRefundOpen = useCallback(
    (open: boolean) => setRefunding(open ? refunding : null),
    [refunding]
  );

  const columns = useMemo<ManagerColumn<ManagerOrder>[]>(
    () => [
      {
        id: "order",
        label: "Order",
        render: (order) => (
          <span className="t-num-sm text-bone">{order.id}</span>
        ),
        sort: (a, b) => a.id.localeCompare(b.id),
        width: "9rem",
      },
      {
        id: "customer",
        label: "Customer",
        render: (order) => (
          <span className="t-body text-bone">
            {order.customer}
            {order.buyerType === "ai_agent" ? (
              <span className="t-label ml-2 rounded-full border border-hairline px-2 py-0.5 text-smoke">
                agent
              </span>
            ) : null}
          </span>
        ),
        sort: (a, b) => a.customer.localeCompare(b.customer),
        width: "auto",
      },
      {
        id: "date",
        label: "Date",
        render: (order) => (
          <span className="t-num-xs text-smoke">{order.placedOn}</span>
        ),
        width: "10rem",
      },
      {
        align: "right",
        id: "items",
        label: "Items",
        render: (order) => (
          <span className="t-num-xs text-smoke">{order.itemCount}</span>
        ),
        sort: (a, b) => a.itemCount - b.itemCount,
        width: "5rem",
      },
      {
        align: "right",
        id: "total",
        label: "Total",
        render: (order) => (
          <span className="t-num-md text-bone">
            {formatPaise(order.totalPaise)}
          </span>
        ),
        sort: (a, b) => a.totalPaise - b.totalPaise,
        width: "10rem",
      },
      {
        align: "right",
        id: "status",
        label: "Status",
        render: (order) => <StatusChip state={order.state} />,
        width: "10rem",
      },
    ],
    []
  );

  const busy = refund.pending || decide.pending;

  const expanded = useCallback(
    (order: ManagerOrder) => (
      <OrderLines
        busy={busy}
        onApprove={onApprove}
        onRefund={setRefunding}
        onReject={onReject}
        order={order}
      />
    ),
    [busy, onApprove, onReject]
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={
          awaitingCount > 0
            ? `${awaitingCount} awaiting you · ${shown.length} shown`
            : `${shown.length} orders`
        }
        title="Orders"
      >
        <ManagerSearch
          className="w-full sm:w-[240px]"
          label="Search orders"
          onValueChange={setQuery}
          placeholder="Order number or customer"
          value={query}
        />
      </ManagerHeading>

      {/* One control, not five pills: the segments share a track so the eye
          reads them as the same question asked five ways. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-6">
        <div className="inline-flex items-center gap-1 rounded-full border border-hairline bg-panel p-1">
          {FILTERS.map((entry) => (
            <FilterSegment
              active={filter === entry.id}
              count={counts.get(entry.id) ?? 0}
              id={entry.id}
              key={entry.id}
              label={entry.label}
              onSelect={setFilter}
            />
          ))}
        </div>
      </div>

      <ManagerTable
        columns={columns}
        empty={
          <div className="flex flex-col items-start gap-5">
            <p className="t-body text-smoke">No orders match that.</p>
            {/* A way out, not a label. An empty state whose only affordance
                is a word you cannot press is a dead end with manners. */}
            <Pill onClick={showAll} size="sm" variant="text">
              Show all orders
            </Pill>
          </div>
        }
        expanded={expanded}
        onToggle={onToggle}
        openKey={openKey}
        rowKey={orderKey}
        rows={shown}
        stickyHead
      />

      <TypedConfirmDialog
        body={`${refunding?.id ?? "This order"} will be refunded in full — ${refunding ? formatPaise(refunding.totalPaise) : ""} back to the customer, through Razorpay. This cannot be undone.`}
        confirmLabel="Refund"
        onConfirm={onRefundConfirm}
        onOpenChange={onRefundOpen}
        open={refunding !== null}
        title="Refund this order"
        word="REFUND"
      />
    </div>
  );
}

export { OrdersScreen };
