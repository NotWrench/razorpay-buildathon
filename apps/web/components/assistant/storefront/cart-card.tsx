"use client";

import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { ToolCard } from "../primitives";

/**
 * The basket, as a cart tool returned it.
 *
 * The subtotal here is indicative — the charged total is settled by the quote
 * tool against live product rows — so the card says so rather than letting a
 * number that was never a price look like one.
 */

export interface CartToolShape {
  lineCount?: number;
  lines?: {
    buildId?: string | null;
    name: string;
    productId: string;
    quantity: number;
    unitPricePaise: number;
  }[];
  subtotalPaise: number;
}

export function CartCard({
  cart,
  slug,
}: {
  cart: CartToolShape;
  slug?: string;
}) {
  const lines = cart.lines ?? [];

  return (
    <ToolCard title="In your cart">
      {lines.length === 0 ? (
        <p className="text-muted-foreground">
          {cart.lineCount === 0
            ? "The cart is empty."
            : `${cart.lineCount ?? 0} line(s) in the cart.`}
        </p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li
              className="flex justify-between gap-2"
              key={`${line.productId}-${line.buildId ?? "loose"}`}
            >
              <span>
                {line.quantity} × {line.name}
                {line.buildId ? (
                  <span className="ml-1 text-muted-foreground text-xs">
                    (build)
                  </span>
                ) : null}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                {formatPaise(line.unitPricePaise * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-baseline justify-between border-border/60 border-t pt-2">
        <span className="text-muted-foreground text-xs">
          Subtotal, before any campaign
        </span>
        <span className="font-semibold tabular-nums">
          {formatPaise(cart.subtotalPaise)}
        </span>
      </div>

      {slug ? (
        <Link
          className="mt-2 inline-block font-medium text-primary text-xs underline underline-offset-4"
          href={`/store/${slug}/cart`}
        >
          Open the cart
        </Link>
      ) : null}
    </ToolCard>
  );
}
