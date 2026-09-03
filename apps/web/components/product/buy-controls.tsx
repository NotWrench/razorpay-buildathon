"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { addToCartAction } from "@/lib/actions/storefront";
import type { StockState } from "@/lib/data/types";

/**
 * Quantity, and the two things you can do with it.
 *
 * The stepper's ceiling is what the store actually has left rather than a
 * round number: a control that lets you ask for nine of something there are
 * two of is a control that exists to produce an error message.
 *
 * "Add to build" adds the same line under the buyer's open build, which is
 * what makes the compatibility strip above it start applying to the basket.
 * Without a build open it is not offered — a button whose effect is invisible
 * teaches people not to press buttons.
 */

const HARD_MAX = 9;

interface BuyControlsProps {
  /** The build the shopper has open, if any. */
  buildId?: string;
  buildName?: string;
  onHand: number;
  productId: string;
  stock: StockState;
}

export function BuyControls({
  buildId,
  buildName,
  onHand,
  productId,
  stock,
}: BuyControlsProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  const max = Math.max(1, Math.min(HARD_MAX, onHand));
  const soldOut = stock === "out_of_stock";

  const decrease = useCallback(
    () => setQuantity((value) => Math.max(1, value - 1)),
    []
  );

  const increase = useCallback(
    () => setQuantity((value) => Math.min(max, value + 1)),
    [max]
  );

  const add = useCallback(
    (intoBuild: boolean) => {
      startTransition(async () => {
        const result = await addToCartAction({
          buildId: intoBuild ? buildId : undefined,
          productId,
          quantity,
        });

        if (result.ok) {
          toast.success(
            intoBuild && buildName
              ? `Added to ${buildName}.`
              : `Added ${quantity} to your cart.`
          );
          router.refresh();

          return;
        }

        toast.error(result.message);
      });
    },
    [buildId, buildName, productId, quantity, router]
  );

  const addLoose = useCallback(() => add(false), [add]);
  const addToBuild = useCallback(() => add(true), [add]);

  return (
    <>
      <div className="mt-8 flex items-center gap-5">
        <Label>Quantity</Label>
        <div className="inline-flex h-11 items-center gap-1 rounded-full border border-hairline px-2">
          <button
            aria-label="One fewer"
            className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone disabled:opacity-40"
            disabled={quantity === 1 || soldOut}
            onClick={decrease}
            type="button"
          >
            <Minus aria-hidden className="size-3.5" />
          </button>
          <span className="w-8 text-center font-mono text-[15px] text-bone tabular-nums">
            {quantity}
          </span>
          <button
            aria-label="One more"
            className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone disabled:opacity-40"
            disabled={quantity >= max || soldOut}
            onClick={increase}
            type="button"
          >
            <Plus aria-hidden className="size-3.5" />
          </button>
        </div>

        {stock === "low_stock" ? (
          <span className="font-mono text-[13px] text-amber tabular-nums">
            {onHand} left
          </span>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Pill disabled={soldOut || pending} onClick={addLoose}>
          {pending ? "Adding…" : "Add to cart"}
        </Pill>

        {buildId ? (
          <Pill
            disabled={soldOut || pending}
            onClick={addToBuild}
            variant="ghost"
          >
            Add to build
          </Pill>
        ) : null}
      </div>
    </>
  );
}
