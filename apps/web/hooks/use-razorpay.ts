"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Razorpay Checkout, as a hook.
 *
 * The script is loaded once on demand rather than on every page, and the
 * handler posts to `/api/payments/verify` — the server checks the signature
 * and settles the order. Nothing here decides that a payment succeeded: the
 * hook reports what the verify route said, which is the §21 rule.
 *
 * The window is test mode, and the last place to say so. Razorpay reads the
 * mode off the key id, so an `rzp_test_` key is the whole declaration — but a
 * key that reached the browser has already passed three server-side checks,
 * and if one of them ever lets a live key through, the next thing that happens
 * is a real charge. Refusing here costs nothing and ends that.
 *
 * Saying so in the window itself is a separate problem. Razorpay's checkout v2
 * paints no test badge of its own and offers no option to ask for one, so the
 * only text we control inside that modal is `name` and `description` — and
 * `description` is where the words go. `notes` carries the same fact onto the
 * payment record, where the dashboard shows it.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Shown under the store name inside the Razorpay window. */
const TEST_MODE_LINE = "Test mode — this payment moves no real money";

export interface RazorpayHandoff {
  amount: number;
  currency: string;
  keyId: string;
  razorpayOrderId: string;
}

function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });

      return;
    }

    const script = document.createElement("script");

    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.append(script);
  });
}

interface OpenOptions {
  handoff: RazorpayHandoff;
  onSettled?: (settled: boolean) => void;
  orderId: string;
  storeName: string;
}

export function useRazorpay() {
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    void loadScript();
  }, []);

  const open = useCallback(
    async ({ handoff, onSettled, orderId, storeName }: OpenOptions) => {
      if (!handoff.keyId.startsWith("rzp_test_")) {
        toast.error("This store is not in test mode. Payment was not started.");

        return;
      }

      const ready = await loadScript();

      if (!(ready && window.Razorpay)) {
        toast.error("The payment window could not be loaded.");

        return;
      }

      setPaying(orderId);

      const checkout = new window.Razorpay({
        amount: handoff.amount,
        currency: handoff.currency,
        description: TEST_MODE_LINE,
        handler: async (response: Record<string, string>) => {
          const verification = await fetch("/api/payments/verify", {
            // The verify route takes Razorpay's own field names, which is
            // what its handler hands us — renaming them here would only be a
            // chance to get one wrong.
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });

          setPaying(null);

          if (verification.ok) {
            toast.success("Payment confirmed");
            onSettled?.(true);

            return;
          }

          toast.error("We could not confirm that payment yet.");
          onSettled?.(false);
        },
        key: handoff.keyId,
        modal: {
          ondismiss: () => {
            setPaying(null);
            onSettled?.(false);
          },
        },
        name: storeName,
        notes: { mode: "test" },
        order_id: handoff.razorpayOrderId,
      });

      checkout.open();
    },
    []
  );

  return { open, paying };
}
