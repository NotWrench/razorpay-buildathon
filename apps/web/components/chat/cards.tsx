"use client";

import { Button } from "@workspace/ui/components/button";
import { formatPaise } from "@/lib/format";
import { ConfidenceBadge, ToolCard } from "./primitives";

/**
 * The renderers for structured tool output.
 *
 * Each takes the tool's own return shape. The quote card in particular exists
 * so the buyer sees the arithmetic — subtotal, which campaign discounted them
 * and by how much, total — before they are ever asked to approve anything.
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
export function ApprovalCard({
  onApprove,
  onDeny,
  reason,
}: {
  onApprove: () => void;
  onDeny: () => void;
  reason?: string;
}) {
  return (
    <ToolCard title="Your approval is needed" tone="warning">
      <p className="text-foreground">
        {reason ?? "This action involves money and needs your confirmation."}
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={onApprove} size="sm">
          Approve
        </Button>
        <Button onClick={onDeny} size="sm" variant="outline">
          Not now
        </Button>
      </div>
    </ToolCard>
  );
}

export function OrderCard({
  approvalStatus,
  breakdown,
  message,
  onPay,
  orderId,
  payable,
  totalPaise,
}: {
  approvalStatus: string;
  breakdown?: string;
  message: string;
  onPay?: () => void;
  orderId: string;
  payable: boolean;
  totalPaise: number;
}) {
  return (
    <ToolCard
      title={
        approvalStatus === "approved" ? "Order ready" : "Order pending approval"
      }
      tone={approvalStatus === "approved" ? "success" : "warning"}
    >
      <p className="font-semibold text-base tabular-nums">
        {formatPaise(totalPaise)}
      </p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {breakdown ? (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-sm bg-muted/50 p-2 text-xs">
          {breakdown}
        </pre>
      ) : null}
      {payable && onPay ? (
        <Button className="mt-3" onClick={onPay} size="sm">
          Pay {formatPaise(totalPaise)}
        </Button>
      ) : null}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        {orderId}
      </p>
    </ToolCard>
  );
}

/** Shown after a declined payment: the reason, then the ways out. */
export function FailureCard({
  failureReason,
  onOption,
  options,
}: {
  failureReason: string | null;
  onOption: (option: string) => void;
  options: string[];
}) {
  return (
    <ToolCard title="Payment did not go through" tone="danger">
      <p className="text-foreground">
        {failureReason ?? "The payment was declined."}
      </p>
      <p className="mt-1 text-muted-foreground text-xs">
        Nothing was charged and your order is intact.
      </p>
      {options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option}
              onClick={() => onOption(option)}
              size="sm"
              variant="outline"
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}
    </ToolCard>
  );
}

export function PaymentLinkCard({
  message,
  url,
}: {
  message: string;
  url: string;
}) {
  return (
    <ToolCard title="Payment link" tone="success">
      <p className="text-muted-foreground">{message}</p>
      <a
        className="mt-2 inline-block break-all font-medium text-primary underline underline-offset-4"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {url}
      </a>
    </ToolCard>
  );
}
