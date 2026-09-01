import type { StockRisk } from "@workspace/ai";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

/**
 * How long the shelf lasts at the current rate of sale.
 *
 * `daysOfCover` is null when nothing has sold, and that is rendered as "no
 * sales" rather than as infinite cover: the same arithmetic produces a reorder
 * candidate and a discount candidate, and collapsing them would send the
 * merchant the wrong way.
 */
export function StockRiskTable({ rows }: { rows: StockRisk[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing is at risk of stocking out.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Per day</TableHead>
          <TableHead className="text-right">Cover</TableHead>
          <TableHead className="text-right">Lead time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell>
              {row.name}
              {row.stocksOutBeforeResupply ? (
                <span className="ml-2 text-destructive text-xs">
                  stocks out before resupply
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.stock}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.dailyVelocity.toFixed(2)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.daysOfCover === null ? (
                <span className="text-muted-foreground">no sales</span>
              ) : (
                `${Math.round(row.daysOfCover)} d`
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.leadTimeDays === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${row.leadTimeDays} d`
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
