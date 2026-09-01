"use client";

import { Button } from "@workspace/ui/components/button";
import { CreditCardIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRazorpay } from "@/hooks/use-razorpay";
import { resumePaymentAction } from "@/lib/actions/pay";

/**
 * Back to the payment window for an order that already exists.
 *
 * The handoff is fetched at click time rather than embedded in the page: an
 * order approved or paid in another tab should not leave a stale "pay now"
 * button that reopens a window for money already taken.
 */
export function ResumePaymentButton({
  orderId,
  slug,
  storeName,
}: {
  orderId: string;
  slug: string;
  storeName: string;
}) {
  const router = useRouter();
  const { open, paying } = useRazorpay();
  const [pending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      const result = await resumePaymentAction({ orderId, slug });

      if (!result.ok) {
        toast.error(result.message);

        return;
      }

      await open({
        handoff: result.data,
        onSettled: () => router.refresh(),
        orderId,
        storeName,
      });
    });
  }

  return (
    <Button disabled={pending || paying === orderId} onClick={pay}>
      <CreditCardIcon />
      Pay now
    </Button>
  );
}
