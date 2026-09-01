import { cn } from "@workspace/ui/lib/utils";

/**
 * Availability, stated exactly.
 *
 * The count is shown once stock is low rather than always: "3 left" is a fact
 * a shopper acts on, while "47 in stock" is noise. Zero never reads as
 * anything but out of stock.
 */
export function StockBadge({
  className,
  lowStockThreshold = 5,
  stock,
}: {
  className?: string;
  lowStockThreshold?: number;
  stock: number;
}) {
  if (stock <= 0) {
    return (
      <span className={cn("text-destructive text-xs", className)}>
        Out of stock
      </span>
    );
  }

  if (stock <= lowStockThreshold) {
    return (
      <span
        className={cn("text-amber-600 text-xs dark:text-amber-400", className)}
      >
        Only {stock} left
      </span>
    );
  }

  return (
    <span className={cn("text-muted-foreground text-xs", className)}>
      In stock
    </span>
  );
}
