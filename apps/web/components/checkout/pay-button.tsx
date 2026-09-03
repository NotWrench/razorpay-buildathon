"use client";

import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRazorpay } from "@/hooks/use-razorpay";
import type { CheckoutBlocked } from "@/lib/actions/storefront";
import {
  checkoutCartAction,
  checkoutPartsAction,
} from "@/lib/actions/storefront";
import { route } from "@/lib/routes";

/** A refused checkout carries the rules it broke; a failed one carries prose. */
function isBlocked(result: { ok: false }): result is CheckoutBlocked {
  return "issues" in result;
}

/**
 * The one action on the checkout page.
 *
 * It decides nothing. The order is created server-side, which is where the
 * build is re-validated and the price re-derived from live product rows; this
 * hands the resulting Razorpay order to the checkout window and then reports
 * whatever `/api/payments/verify` said. A component that congratulated the
 * shopper on its own would eventually congratulate them for a payment that
 * failed.
 */

interface PayButtonProps {
  /** The parts the assistant assembled, when the page was reached that way. */
  parts?: string[];
  storeName: string;
  totalPaise: number;
}

export function PayButton({ parts, storeName, totalPaise }: PayButtonProps) {
  const router = useRouter();
  const { open, paying } = useRazorpay();
  const [pending, startTransition] = useTransition();
  const [blocking, setBlocking] = useState<CompatibilityIssue[]>([]);

  const pay = useCallback(() => {
    setBlocking([]);

    startTransition(async () => {
      const result = parts?.length
        ? await checkoutPartsAction(parts)
        : await checkoutCartAction();

      if (!result.ok) {
        if (isBlocked(result)) {
          setBlocking(result.issues);
          toast.error("This build cannot be ordered as it stands.");

          return;
        }

        toast.error(result.message);

        return;
      }

      const { checkout, orderId, warnings } = result.data;

      for (const warning of warnings) {
        toast.warning(warning.message);
      }

      const done = () => router.push(route("/account#orders"));

      if (!checkout) {
        toast.info("Your order was created and is waiting for approval.");
        done();

        return;
      }

      await open({ handoff: checkout, onSettled: done, orderId, storeName });
    });
  }, [open, parts, router, storeName]);

  const busy = pending || paying !== null;

  return (
    <>
      <Pill
        className="mt-7 w-full justify-center"
        disabled={busy || totalPaise <= 0}
        onClick={pay}
      >
        {busy ? "Working…" : `Pay ${formatPaise(totalPaise)}`}
      </Pill>

      {blocking.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {blocking.map((issue) => (
            <StatusLine
              key={issue.rule}
              message={issue.message}
              state="incompatible"
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
