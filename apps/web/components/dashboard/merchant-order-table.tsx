import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Money } from "@/components/common/money";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatDateTime } from "@/lib/format";
import type { MerchantOrderRow } from "@/lib/queries/admin";

/**
 * Every order in the store.
 *
 * The buyer column distinguishes an agent from a person, because that is what
 * decides whether the order needed approval before money could move.
 */
export function MerchantOrderTable({ rows }: { rows: MerchantOrderRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No orders yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ itemSummary, order }) => (
          <TableRow key={order.id}>
            <TableCell>
              <p className="text-sm">{itemSummary || "—"}</p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(order.createdAt)} ·{" "}
                <span className="font-mono">{order.id.slice(0, 8)}</span>
              </p>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {order.buyerType === "ai_agent" ? (
                  <Badge variant="secondary">agent</Badge>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {order.buyerIdentifier}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <OrderStatusBadge
                approvalStatus={order.approvalStatus}
                orderStatus={order.orderStatus}
              />
            </TableCell>
            <TableCell className="text-right">
              <Money
                currency={order.currency}
                paise={order.totalAmount}
                size="sm"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
