"use client";

import { formatPaise } from "@/lib/format";
import { ToolCard } from "../primitives";

export interface QuoteShape {
  appliedCampaign: { discountPaise: number; title: string } | null;
  currency: string;
  discountPaise: number;
  lines: {
    isUpsell: boolean;
    name: string;
    productId: string;
    quantity: number;
    subtotalPaise: number;
    unitPricePaise: number;
  }[];
  subtotalPaise: number;
  totalPaise: number;
}

/** The full price breakdown. Nothing is charged by showing this. */

export function QuoteCard({ quote }: { quote: QuoteShape }) {
  return (
    <ToolCard title="Price breakdown">
      <table className="w-full text-sm">
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.productId}>
              <td className="py-1 pr-2">
                {line.quantity} × {line.name}
                {line.isUpsell ? (
                  <span className="ml-1 text-muted-foreground text-xs">
                    (add-on)
                  </span>
                ) : null}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatPaise(line.subtotalPaise, quote.currency)}
              </td>
            </tr>
          ))}
          <tr className="border-border/60 border-t">
            <td className="py-1 pr-2 text-muted-foreground">Subtotal</td>
            <td className="py-1 text-right tabular-nums">
              {formatPaise(quote.subtotalPaise, quote.currency)}
            </td>
          </tr>
          {quote.appliedCampaign ? (
            <tr>
              <td className="py-1 pr-2 text-emerald-700 dark:text-emerald-400">
                {quote.appliedCampaign.title}
              </td>
              <td className="py-1 text-right text-emerald-700 tabular-nums dark:text-emerald-400">
                −{formatPaise(quote.discountPaise, quote.currency)}
              </td>
            </tr>
          ) : null}
          <tr className="border-border border-t font-semibold">
            <td className="py-1 pr-2">Total</td>
            <td className="py-1 text-right tabular-nums">
              {formatPaise(quote.totalPaise, quote.currency)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground text-xs">
        Nothing has been charged. This is a quote.
      </p>
    </ToolCard>
  );
}

/**
 * The gate. Rendered whenever a money tool asks for approval.
 *
 * The reason string comes from the server-side approval policy and carries the
 * real total, so what the buyer approves is what the server will act on.
 */
