"use client";

import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { TypedConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable } from "@/components/manager/manager-table";
import type { ManagerOrder, ManagerOrderState } from "@/lib/data/types";

/**
 * Orders, and the two things you do to them.
 *
 * Status is plain smoke text. Only the states that are not the normal course
 * of business get colour — Cancelled in lacquer, Refunded in amber — because a
 * column where every row is coloured is a column nobody reads.
 */

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "due", label: "Due" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "cancelled", label: "Cancelled" },
];

const STATE_WORD: Record<ManagerOrderState, string> = {
  cancelled: "Cancelled",
  due: "Due",
  fulfilled: "Fulfilled",
  new: "New",
  refunded: "Refunded",
};

const STATE_TONE: Record<ManagerOrderState, string> = {
  cancelled: "text-lacquer",
  due: "text-smoke",
  fulfilled: "text-smoke",
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
  onFulfil,
  onRefund,
  order,
}: {
  onFulfil: (order: ManagerOrder) => void;
  onRefund: (order: ManagerOrder) => void;
  order: ManagerOrder;
}) {
  const fulfil = useCallback(() => onFulfil(order), [onFulfil, order]);
  const refund = useCallback(() => onRefund(order), [onRefund, order]);

  return (
    <div>
      <ul>
        {order.lines.map((line) => (
          <li
            className="flex items-baseline justify-between gap-6 py-1.5"
            key={line.name}
          >
            <span className="t-body-sm min-w-0 truncate text-smoke">
              {line.quantity > 1 ? `${line.quantity} × ` : ""}
              {line.name}
            </span>
            <span className="t-num-xs shrink-0 text-smoke">
              {formatPaise(line.pricePaise * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-3">
        <Pill onClick={fulfil} size="sm" variant="ghost">
          Mark fulfilled
        </Pill>
        <Pill onClick={refund} size="sm" variant="ghost">
          Refund
        </Pill>
      </div>
    </div>
  );
}

function OrdersScreen({ orders }: { orders: ManagerOrder[] }) {
  const [filter, setFilter] = useState("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<ManagerOrder | null>(null);
  const [rows, setRows] = useState(orders);

  const shown = useMemo(
    () =>
      filter === "all" ? rows : rows.filter((order) => order.state === filter),
    [filter, rows]
  );

  const onToggle = useCallback(
    (key: string) => setOpenKey((current) => (current === key ? null : key)),
    []
  );

  const showAll = useCallback(() => setFilter("all"), []);

  const onFulfil = useCallback((order: ManagerOrder) => {
    setRows((current) =>
      current.map((entry) =>
        entry.id === order.id ? { ...entry, state: "fulfilled" } : entry
      )
    );
    toast(`${order.id} marked fulfilled.`);
  }, []);

  const onRefundConfirm = useCallback(() => {
    if (!refunding) {
      return;
    }

    const target = refunding;

    setRows((current) =>
      current.map((entry) =>
        entry.id === target.id ? { ...entry, state: "refunded" } : entry
      )
    );
    setRefunding(null);
    toast(`${target.id} refunded — ${formatPaise(target.totalPaise)}.`);
  }, [refunding]);

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
          <span className="t-num-sm text-bone">
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
          <span className="t-body text-bone">{order.customer}</span>
        ),
        sort: (a, b) => a.customer.localeCompare(b.customer),
        width: "auto",
      },
      {
        id: "date",
        label: "Date",
        render: (order) => (
          <span className="t-num-xs text-smoke">
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
          <span className="t-num-xs text-smoke">
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
          <span className="t-num-sm text-bone">
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
          <span className={cn("t-body-sm", STATE_TONE[order.state])}>
            {STATE_WORD[order.state]}
          </span>
        ),
        width: "7rem",
      },
    ],
    []
  );

  const expanded = useCallback(
    (order: ManagerOrder) => (
      <OrderLines onFulfil={onFulfil} onRefund={setRefunding} order={order} />
    ),
    [onFulfil]
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading count={`${shown.length} orders`} title="Orders" />

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
            <p className="t-body text-smoke">No orders in this filter.</p>
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
        body={`${refunding?.id ?? "This order"} will be refunded in full — ${refunding ? formatPaise(refunding.totalPaise) : ""} back to the customer. This cannot be undone.`}
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
