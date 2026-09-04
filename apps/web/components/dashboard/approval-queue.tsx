"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPaise } from "@/lib/format";

/**
 * The human-in-the-loop queue.
 *
 * Every order here was created by a buying agent and is sitting unpaid with no
 * Razorpay order behind it. Approving is the moment money becomes possible, so
 * the agent's stated reason is shown in full rather than truncated — it is the
 * merchant's only evidence for the decision.
 */

export interface QueuedOrder {
  buyerIdentifier: string;
  buyerType: string;
  id: string;
  items: string[];
  reason: string | null;
  totalAmount: number;
}

export function ApprovalQueue({ orders }: { orders: QueuedOrder[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(orderId: string, decision: "approve" | "reject") {
    setBusy(orderId);
    setError(null);

    try {
      const response = await fetch(
        `/api/payments/orders/${orderId}/${decision}`,
        {
          body: JSON.stringify({
            explanation:
              decision === "approve"
                ? "Merchant approved from the dashboard queue"
                : "Merchant rejected from the dashboard queue",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        setError(body?.error?.message ?? "That did not work.");

        return;
      }

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="t-label mb-2 text-muted-foreground">
        Waiting for approval ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing pending. Agent orders land here before any money can move.
        </p>
      ) : null}

      {error ? <p className="mb-2 text-destructive text-xs">{error}</p> : null}

      <ul className="space-y-3">
        {orders.map((order) => (
          <li
            className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
            key={order.id}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium leading-tight">
                {order.items.join(", ") || "No items"}
              </span>
              <span className="whitespace-nowrap font-semibold tabular-nums">
                {formatPaise(order.totalAmount)}
              </span>
            </div>

            <p className="mt-1 text-muted-foreground text-xs">
              {order.buyerType === "ai_agent" ? "Buyer agent" : "Shopper"} ·{" "}
              <span className="font-mono">{order.buyerIdentifier}</span>
            </p>

            {order.reason ? (
              <p className="mt-2 border-amber-500/40 border-l-2 pl-2 text-muted-foreground text-xs italic">
                {order.reason}
              </p>
            ) : (
              <p className="mt-2 text-destructive text-xs">
                No reason given — treat with suspicion.
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                disabled={busy === order.id}
                onClick={() => decide(order.id, "approve")}
                size="sm"
              >
                Approve
              </Button>
              <Button
                disabled={busy === order.id}
                onClick={() => decide(order.id, "reject")}
                size="sm"
                variant="outline"
              >
                Reject
              </Button>
              <a
                className="self-center text-muted-foreground text-xs underline underline-offset-4"
                href={`/api/agent/trace/${order.id}`}
                rel="noreferrer"
                target="_blank"
              >
                Trace
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
