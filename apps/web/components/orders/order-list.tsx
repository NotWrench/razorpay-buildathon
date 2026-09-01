import { ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { formatDateTime } from "@/lib/format";
import type { OrderListEntry } from "@/lib/queries/orders";
import { OrderStatusBadge } from "./order-status-badge";

/** The buyer's order history. */
export function OrderList({
  entries,
  slug,
}: {
  entries: OrderListEntry[];
  slug: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        description="Orders you place in this shop will appear here, with their payment state."
        icon={ReceiptTextIcon}
        title="No orders yet"
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {entries.map(({ itemCount, order, summary }) => (
        <li key={order.id}>
          <Link
            className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/40"
            href={`/store/${slug}/orders/${order.id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {summary || `${itemCount} item(s)`}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {formatDateTime(order.createdAt)} ·{" "}
                <span className="font-mono">{order.id.slice(0, 8)}</span>
              </p>
            </div>

            <OrderStatusBadge
              approvalStatus={order.approvalStatus}
              orderStatus={order.orderStatus}
            />

            <Money currency={order.currency} paise={order.totalAmount} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
