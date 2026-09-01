import { Badge } from "@workspace/ui/components/badge";
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
import type { CatalogProduct } from "@/lib/queries/catalog";

/**
 * The catalog as the merchant sees it.
 *
 * The "specs" column reports whether a product has a spec row at all, because
 * a part without one cannot be checked for compatibility — it will reach every
 * rule as `insufficient_data`, and that is a listing problem the merchant can
 * fix.
 */
export function ProductTable({
  products,
  slug,
}: {
  products: CatalogProduct[];
  slug: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Specs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <Link
                className="hover:underline"
                href={`/store/${slug}/products/${product.id}`}
              >
                {product.name}
              </Link>
              {product.isActive ? null : (
                <Badge className="ml-2" variant="secondary">
                  inactive
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs uppercase">
              {product.category ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              <Money paise={product.price} size="sm" />
            </TableCell>
            <TableCell
              className={
                product.stock === 0
                  ? "text-right text-destructive tabular-nums"
                  : "text-right tabular-nums"
              }
            >
              {product.stock}
            </TableCell>
            <TableCell className="text-right">
              {product.specs ? (
                <span className="text-emerald-600 text-xs dark:text-emerald-400">
                  published
                </span>
              ) : (
                <span className="text-amber-600 text-xs dark:text-amber-400">
                  missing
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
