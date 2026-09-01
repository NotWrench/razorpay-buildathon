"use client";

import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { IssueList } from "@/components/build/issue-list";
import { Money } from "@/components/common/money";
import { useRazorpay } from "@/hooks/use-razorpay";
import { startCheckoutAction } from "@/lib/actions/checkout";

/**
 * Checkout.
 *
 * The order is created server-side, which is where the build in the cart is
 * re-validated and the price re-derived from live product rows; this component
 * only hands the resulting Razorpay order to the checkout window. It never
 * decides that a payment succeeded — the verify route does, and the page is
 * refreshed to show whatever the backend recorded.
 */
export function CheckoutPanel({
  cartId,
  currency,
  itemCount,
  slug,
  storeName,
  subtotalPaise,
}: {
  cartId: string;
  currency?: string;
  itemCount: number;
  slug: string;
  storeName: string;
  subtotalPaise: number;
}) {
  const router = useRouter();
  const { open, paying } = useRazorpay();
  const [pending, startTransition] = useTransition();
  const [blocking, setBlocking] = useState<CompatibilityIssue[]>([]);

  function checkout() {
    setBlocking([]);

    startTransition(async () => {
      const result = await startCheckoutAction({ cartId, slug });

      if (!result.ok) {
        if ("issues" in result) {
          setBlocking(result.issues);
          toast.error("This build cannot be ordered as it stands.");

          return;
        }

        toast.error(result.message);

        return;
      }

      const { checkout: handoff, orderId, warnings } = result.data;

      for (const warning of warnings) {
        toast.warning(warning.message);
      }

      if (!handoff) {
        toast.info("Your order was created and is waiting for approval.");
        router.push(`/store/${slug}/orders/${orderId}`);

        return;
      }

      await open({
        handoff,
        onSettled: () => router.push(`/store/${slug}/orders/${orderId}`),
        orderId,
        storeName,
      });
    });
  }

  const busy = pending || paying !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">
            Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})
          </span>
          <Money currency={currency} paise={subtotalPaise} size="lg" />
        </div>

        <p className="text-muted-foreground text-xs">
          Any active campaign discount is applied when the order is priced.
        </p>

        <Button
          className="w-full"
          disabled={busy || itemCount === 0}
          onClick={checkout}
        >
          {busy ? "Working…" : "Checkout"}
        </Button>

        {blocking.length > 0 ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <p className="mb-2 font-semibold text-destructive text-xs uppercase tracking-widest">
              Checkout blocked
            </p>
            <IssueList issues={blocking} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
