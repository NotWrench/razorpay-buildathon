"use client";

import { Button } from "@workspace/ui/components/button";
import { formatPaise } from "@/lib/format";
import { ToolCard } from "../primitives";

/**
 * What the money path says back.
 *
 * An order card always states the total and whether anything can be paid yet;
 * a failure card always states that nothing was charged. Both are the buyer's
 * only reliable account of what happened, so neither is ever prose.
 */

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
      <p className="t-num-xs mt-2 text-muted-foreground">
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
