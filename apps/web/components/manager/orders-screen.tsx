"use client";

import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { TypedConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
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
 * Status is plain smoke text. Only the states that are not the normal course
 * of business get colour — Cancelled in lacquer, Refunded and Awaiting in
 * amber — because a column where every row is coloured is a column nobody
 * reads.
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
  awaiting: "text-amber",
  cancelled: "text-lacquer",
  due: "text-smoke",
  new: "text-smoke",
  refunded: "text-amber",
};

const orderKey = (order: ManagerOrder) => order.id;

function FilterPill({
  active,
  id,
  label,
  onSelect,
}: {
  active: boolean;
  id: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const click = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <Pill
      aria-pressed={active}
      className={cn(active && "border-bone bg-bone text-void hover:bg-bone")}
      onClick={click}
      size="sm"
      variant="ghost"
    >
      {label}
    </Pill>
  );
}

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
    <div>
      <ul>
        {order.lines.map((line) => (
          <li
            className="flex items-baseline justify-between gap-6 py-1.5"
            key={line.name}
          >
            <span className="min-w-0 truncate text-[14px] text-smoke">
              {line.quantity > 1 ? `${line.quantity} × ` : ""}
              {line.name}
            </span>
            <span className="shrink-0 font-mono text-[14px] text-smoke tabular-nums">
              {formatPaise(line.pricePaise * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {order.buyerType === "ai_agent" ? (
        <div className="mt-5 border-hairline border-l-2 pl-4">
          <p className="text-[13px] text-smoke">
            {order.agentReason ??
              "No reason given — treat this one with suspicion."}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
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
          <p className="text-[13px] text-smoke">
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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<ManagerOrder | null>(null);

  const refund = useAction(refundOrderAction, {
    onSuccess: () => setRefunding(null),
    successMessage: "Refunded. Razorpay confirmed it.",
  });

  const decide = useAction(decideAgentOrderAction);

  const shown = useMemo(
    () =>
      filter === "all"
        ? orders
        : orders.filter((order) => order.state === filter),
    [filter, orders]
  );

  const awaitingCount = useMemo(
    () => orders.filter((order) => order.state === "awaiting").length,
    [orders]
  );

  const onToggle = useCallback(
    (key: string) => setOpenKey((current) => (current === key ? null : key)),
    []
  );

  const showAll = useCallback(() => setFilter("all"), []);

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
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {order.id}
          </span>
        ),
        sort: (a, b) => a.id.localeCompare(b.id),
        width: "8rem",
      },
      {
        id: "customer",
        label: "Customer",
        render: (order) => (
          <span className="t-body text-bone">
            {order.customer}
            {order.buyerType === "ai_agent" ? (
              <span className="ml-2 t-body-sm text-smoke">agent</span>
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
          <span className="font-mono text-[13px] text-smoke tabular-nums">
            {order.placedOn}
          </span>
        ),
        width: "9rem",
      },
      {
        align: "right",
        id: "items",
        label: "Items",
        render: (order) => (
          <span className="font-mono text-[13px] text-smoke tabular-nums">
            {order.itemCount}
          </span>
        ),
        sort: (a, b) => a.itemCount - b.itemCount,
        width: "5rem",
      },
      {
        align: "right",
        id: "total",
        label: "Total",
        render: (order) => (
          <span className="font-mono text-[15px] text-bone tabular-nums">
            {formatPaise(order.totalPaise)}
          </span>
        ),
        sort: (a, b) => a.totalPaise - b.totalPaise,
        width: "9rem",
      },
      {
        align: "right",
        id: "status",
        label: "Status",
        render: (order) => (
          <span className={cn("text-[13px]", STATE_TONE[order.state])}>
            {STATE_WORD[order.state]}
          </span>
        ),
        width: "8rem",
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
      />

      <div className="flex flex-wrap gap-3 pb-6">
        {FILTERS.map((entry) => (
          <FilterPill
            active={filter === entry.id}
            id={entry.id}
            key={entry.id}
            label={entry.label}
            onSelect={setFilter}
          />
        ))}
      </div>

      <ManagerTable
        columns={columns}
        empty={
          <div className="flex flex-col items-start gap-5">
            <p className="text-[16px] text-smoke">No orders in this filter.</p>
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
