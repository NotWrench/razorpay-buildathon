"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/common/money";
import { StockBadge } from "@/components/product/stock-badge";
import { useCartActions } from "@/hooks/use-cart-actions";
import type { CartLineView } from "@/lib/queries/cart";

/**
 * One line in the basket.
 *
 * A line that belongs to a build says so, because removing it is a different
 * act from removing a spare — the commerce layer keys those lines on the build
 * and will not find them without it.
 *
 * When the live price differs from the one captured at add time, both are
 * shown. Quietly repricing is the one thing a cart must never do.
 */
export function CartLineRow({
  currency,
  line,
  slug,
}: {
  currency?: string;
  line: CartLineView;
  slug: string;
}) {
  const { addProduct, pending, removeProduct } = useCartActions(slug);

  const options = line.buildId ? { buildId: line.buildId } : undefined;

  return (
    <div className="flex items-start gap-3 border-border border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="font-medium text-sm hover:underline"
            href={`/store/${slug}/products/${line.productId}`}
          >
            {line.name}
          </Link>
          {line.buildId ? <Badge variant="secondary">Build</Badge> : null}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <Money currency={currency} paise={line.unitPricePaise} size="sm" />
          <StockBadge stock={line.inStock} />
        </div>

        {line.priceChanged ? (
          <p className="mt-1 text-amber-600 text-xs dark:text-amber-400">
            Price changed since you added this — it was{" "}
            <Money
              currency={currency}
              paise={line.unitPriceWhenAddedPaise}
              size="sm"
            />
            .
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          aria-label="Reduce quantity"
          disabled={pending}
          onClick={() =>
            removeProduct(line.productId, { ...options, quantity: 1 })
          }
          size="icon-xs"
          variant="outline"
        >
          <MinusIcon />
        </Button>
        <span className="w-6 text-center text-sm tabular-nums">
          {line.quantity}
        </span>
        <Button
          aria-label="Increase quantity"
          disabled={pending || line.quantity >= line.inStock}
          onClick={() =>
            addProduct(line.productId, 1, line.buildId ?? undefined)
          }
          size="icon-xs"
          variant="outline"
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="w-24 text-right">
        <Money
          currency={currency}
          paise={line.unitPricePaise * line.quantity}
        />
      </div>

      <Button
        aria-label={`Remove ${line.name}`}
        disabled={pending}
        onClick={() => removeProduct(line.productId, options)}
        size="icon-xs"
        variant="ghost"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
