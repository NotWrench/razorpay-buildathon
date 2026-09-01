"use client";

import { formatPaise } from "@/lib/format";
import { ConfidenceBadge, ToolCard } from "../primitives";

/**
 * Products, as the agent returns them.
 *
 * A search result and an upsell suggestion are the same shape, so they share
 * one grid — the difference is the title above it and the evidence line under
 * each card, which is where a suggestion has to justify itself.
 */

export interface ProductLike {
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  id: string;
  imageUrl?: string | null;
  inStock?: boolean;
  name: string;
  pricePaise: number;
  stock?: number;
}

export function ProductGrid({
  note,
  products,
  title,
}: {
  note?: string;
  products: (ProductLike & { attachRate?: number; evidence?: string })[];
  title: string;
}) {
  if (products.length === 0) {
    return (
      <ToolCard title={title}>
        <p className="text-muted-foreground">
          {note ?? "Nothing in the catalog matched that."}
        </p>
      </ToolCard>
    );
  }

  return (
    <ToolCard title={title}>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((product) => (
          <div
            className="rounded-sm border border-border/60 p-2"
            key={product.id}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight">{product.name}</p>
              <p className="whitespace-nowrap font-semibold tabular-nums">
                {formatPaise(product.pricePaise)}
              </p>
            </div>
            {product.brand ? (
              <p className="mt-0.5 text-muted-foreground text-xs">
                {product.brand}
                {product.category ? ` · ${product.category}` : ""}
              </p>
            ) : null}
            {product.evidence ? (
              <p className="mt-1 text-muted-foreground text-xs italic">
                {product.evidence}
              </p>
            ) : null}
            {product.inStock === false ? (
              <p className="mt-1 text-destructive text-xs">Out of stock</p>
            ) : null}
          </div>
        ))}
      </div>
      {note ? (
        <p className="mt-2 text-muted-foreground text-xs">{note}</p>
      ) : null}
    </ToolCard>
  );
}

export function RecommendationCard({
  recommendations,
}: {
  recommendations: { confidence: number; productId: string; reason: string }[];
}) {
  return (
    <ToolCard title="Why these">
      <ul className="space-y-2">
        {recommendations.map((item) => (
          <li key={item.productId}>
            <div className="flex items-start gap-2">
              <ConfidenceBadge value={item.confidence} />
              <p className="flex-1 text-muted-foreground">{item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </ToolCard>
  );
}
