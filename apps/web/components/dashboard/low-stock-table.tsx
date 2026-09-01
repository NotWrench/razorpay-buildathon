import type { LowStockProduct } from "@workspace/ai";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

/**
 * What is running out.
 *
 * A product with no configured threshold shows "not set" rather than a zero —
 * §10 asks the operational side to surface its assumptions instead of
 * inventing them, and an unconfigured product is not a healthy one.
 */
export function LowStockTable({ rows }: { rows: LowStockProduct[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing is at or below its threshold.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Threshold</TableHead>
          <TableHead className="text-right">Reorder</TableHead>
          <TableHead className="text-right">Lead time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell>
              {row.name}
              {row.sku ? (
                <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                  {row.sku}
                </span>
              ) : null}
            </TableCell>
            <TableCell
              className={
                row.stock === 0
                  ? "text-right text-destructive tabular-nums"
                  : "text-right tabular-nums"
              }
            >
              {row.stock}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.lowStockThreshold ?? (
                <span className="text-muted-foreground">not set</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.reorderQuantity ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.supplierLeadTimeDays === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${row.supplierLeadTimeDays} d`
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
