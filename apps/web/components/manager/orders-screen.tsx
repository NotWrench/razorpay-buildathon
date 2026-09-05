"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { TypedConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import { ManagerSearch } from "@/components/manager/manager-search";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable } from "@/components/manager/manager-table";
import type { ManagerOrder, ManagerOrderState } from "@/lib/data/types";

/**
 * Orders, and the two things you do to them.
 *
 * Still a table, because an order is six values and a column is the right
 * shape for that. What changed is that the five filters were five loose pills
 * with no sense of being one control and no idea how many orders were behind
 * each of them — they are one track now, and each segment carries its count.
 *
 * Status wears a chip so the column has an edge to scan down, but the colour
 * rule is unchanged: only the states that are not the normal course of
 * business get any — Cancelled in ember, Refunded in amber. A column where
 * every row is coloured is a column nobody reads.
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
  cancelled: "border-ember/40 text-ember",
  due: "border-hairline text-smoke",
  fulfilled: "border-hairline text-smoke",
  new: "border-smoke/40 text-bone",
  refunded: "border-amber/40 text-amber",
};

const orderKey = (order: ManagerOrder) => order.id;

function StatusChip({ state }: { state: ManagerOrderState }) {
  return (
    <span
      className={cn(
        "t-body-sm inline-flex h-7 items-center rounded-full border px-3",
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
 * What is in the order, and the two things you can do about it.
 *
 * The lines carry no image — an order line is a name, a quantity and a price,
 * and there is no product record behind it to render — so this stays
 * typographic and gets its structure from a totals rule instead.
 */
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
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<ManagerOrder | null>(null);
  const [rows, setRows] = useState(orders);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: rows.length };

    for (const entry of rows) {
      tally[entry.state] = (tally[entry.state] ?? 0) + 1;
    }

    return tally;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter(
      (order) =>
        (filter === "all" || order.state === filter) &&
        (needle.length === 0 ||
          order.id.toLowerCase().includes(needle) ||
          order.customer.toLowerCase().includes(needle))
    );
  }, [filter, query, rows]);

  const onToggle = useCallback(
    (key: string) => setOpenKey((current) => (current === key ? null : key)),
    []
  );

  const showAll = useCallback(() => {
    setFilter("all");
    setQuery("");
  }, []);

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
          <span className="t-num-sm text-bone">{order.id}</span>
        ),
        sort: (a, b) => a.id.localeCompare(b.id),
        width: "9rem",
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
        width: "9rem",
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
      <ManagerHeading
        count={
          shown.length === rows.length
            ? `${rows.length} orders`
            : `${shown.length} of ${rows.length}`
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
              count={counts[entry.id] ?? 0}
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
