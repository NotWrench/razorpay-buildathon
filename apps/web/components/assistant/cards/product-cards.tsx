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

/**
 * One recommendation as the model wrote it: a best fit, and an upgrade only
 * when it could name the stated requirement the extra spend serves.
 *
 * This mirrors `recommendProducts`' input schema. It was flat once, and when
 * the tool grew the two-level shape this card was not brought along — so every
 * field read here was `undefined`, the reason rendered blank, and the badge
 * rendered `NaN% confident` while the model narrated the real number in prose.
 */
export interface RecommendationShape {
  bestFit: { confidence: number; productId: string; reason: string };
  upgrade?: {
    benefit: string;
    confidence: number;
    productId: string;
    tiedToRequirement: string;
  };
}

/** The same recommendation as the server resolved it: names, prices, the gap. */
export interface RecommendationEcho {
  products?: { name: string; pricePaise: number; productId: string }[];
  upgrades?: {
    additionalSpendPaise: number;
    productId: string;
    tiedToRequirement: string;
  }[];
}

export function RecommendationCard({
  echo,
  recommendations,
}: {
  echo: RecommendationEcho;
  recommendations: RecommendationShape[];
}) {
  const named = new Map(
    (echo.products ?? []).map((product) => [product.productId, product])
  );

  // The extra spend comes from the tool's own arithmetic over catalog prices,
  // never from subtracting two numbers here. §19 puts the maths behind any
  // figure the buyer acts on on the server, and "only ₹22,000 more" is exactly
  // such a figure.
  const gaps = new Map(
    (echo.upgrades ?? []).map((upgrade) => [
      upgrade.productId,
      upgrade.additionalSpendPaise,
    ])
  );

  return (
    <ToolCard title="Why these">
      <ul className="space-y-3">
        {recommendations.map((item) => {
          const bestFit = named.get(item.bestFit.productId);
          const upgrade = item.upgrade
            ? named.get(item.upgrade.productId)
            : undefined;
          const gap = item.upgrade ? gaps.get(item.upgrade.productId) : undefined;

          return (
            <li key={item.bestFit.productId}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight">
                  {bestFit?.name ?? "This product"}
                </p>
                {bestFit ? (
                  <p className="whitespace-nowrap font-semibold tabular-nums">
                    {formatPaise(bestFit.pricePaise)}
                  </p>
                ) : null}
              </div>
              <div className="mt-1 flex items-start gap-2">
                <ConfidenceBadge value={item.bestFit.confidence} />
                <p className="flex-1 text-muted-foreground">
                  {item.bestFit.reason}
                </p>
              </div>

              {item.upgrade ? (
                <div className="mt-2 border-border/60 border-l-2 pl-2">
                  <p className="font-medium leading-tight">
                    Worth {gap === undefined ? "more" : formatPaise(gap)} more:{" "}
                    {upgrade?.name ?? "an upgrade"}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {item.upgrade.benefit}
                  </p>
                  <p className="mt-0.5 text-muted-foreground text-xs italic">
                    Because you said: {item.upgrade.tiedToRequirement}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ToolCard>
  );
}
