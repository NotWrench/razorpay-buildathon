"use client";

import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useId, useState } from "react";
import type { AccountOrder } from "@/lib/data/types";

/**
 * Orders, on hairlines.
 *
 * Status is plain text, and only `cancelled` gets colour. Three green ticks
 * and a red cross in a column teaches the eye to skip the column; one red word
 * in a list of grey ones is read every time.
 *
 * A row opens in place. The lines do not slide the rows below them apart —
 * they appear and fade in, because animating the height of a table is how a
 * list ends up moving under the cursor that is trying to click it.
 */

const STATE_WORD: Record<AccountOrder["state"], string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  processing: "Processing",
  shipped: "Shipped",
};

function OrderRow({ order }: { order: AccountOrder }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  return (
    <div className="border-hairline border-b">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className={cn(
          "grid w-full grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 py-5 text-left",
          "md:grid-cols-[7rem_8rem_1fr_6rem_7rem]",
          "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-4"
        )}
        onClick={toggle}
        type="button"
      >
        <span className="t-num-sm text-bone">
          {order.id}
        </span>
        <span className="t-num-xs text-smoke">
          {order.placedOn}
        </span>
        <span className="t-num-xs text-smoke">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </span>
        <span className="t-num-sm text-bone md:text-right">
          {formatPaise(order.totalPaise)}
        </span>
        <span
          className={cn(
            "t-body-sm md:text-right",
            order.state === "cancelled" ? "text-lacquer" : "text-smoke"
          )}
        >
          {STATE_WORD[order.state]}
        </span>
      </button>

      {open ? (
        <ul className="order-lines pb-6" id={panelId}>
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
      ) : null}
    </div>
  );
}

function OrderTable({ orders }: { orders: AccountOrder[] }) {
  return (
    <div className="mt-6 border-hairline border-t">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  );
}

export { OrderTable };
