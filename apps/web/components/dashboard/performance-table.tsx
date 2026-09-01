import type { ProductPerformance } from "@workspace/ai";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import Link from "next/link";
import { Money } from "@/components/common/money";

/**
 * Units and revenue per product over a window.
 *
 * The same table serves the fast and the slow end of the catalog — what
 * changes is the sort and the title, not the columns, because the merchant is
 * comparing the same facts either way.
 */
export function PerformanceTable({
  rows,
  slug,
}: {
  rows: ProductPerformance[];
  slug: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No sales in this window yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell>
              <Link
                className="hover:underline"
                href={`/store/${slug}/products/${row.productId}`}
              >
                {row.name}
              </Link>
              {row.category ? (
                <span className="ml-2 text-muted-foreground text-xs uppercase">
                  {row.category}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.unitsSold}
            </TableCell>
            <TableCell className="text-right">
              <Money paise={row.revenuePaise} size="sm" />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.stock}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
