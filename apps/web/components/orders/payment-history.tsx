import type { Payment } from "@workspace/db";
import { Money } from "@/components/common/money";
import { formatDateTime } from "@/lib/format";

/**
 * Every payment attempt against this order.
 *
 * Attempts are listed rather than summarised: a captured payment after two
 * failures is a different story from a clean one, and it is the buyer's own
 * record of what their bank did.
 */
export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No payment has been attempted yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {payments.map((payment) => (
        <li
          className="flex flex-wrap items-baseline justify-between gap-2 border-border/60 border-b pb-2 last:border-b-0"
          key={payment.id}
        >
          <div>
            <p className="font-medium text-sm capitalize">{payment.status}</p>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(payment.createdAt)}
              {payment.razorpayPaymentId
                ? ` · ${payment.razorpayPaymentId}`
                : ""}
            </p>
            {payment.failureReason ? (
              <p className="mt-0.5 text-destructive text-xs">
                {payment.failureReason}
              </p>
            ) : null}
          </div>
          <Money currency={payment.currency} paise={payment.amount} size="sm" />
        </li>
      ))}
    </ul>
  );
}
