"use client";

import { Label } from "@workspace/ui/components/label";
import { Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";

/**
 * How many. A pill, like everything else that takes a press.
 *
 * The value is mono because it is a number, and the buttons disable at the
 * ends rather than silently refusing — a control that looks live and does
 * nothing is worse than one that says it is finished.
 */
function QuantityStepper({ max = 9 }: { max?: number }) {
  const [quantity, setQuantity] = useState(1);

  const decrease = useCallback(
    () => setQuantity((value) => Math.max(1, value - 1)),
    []
  );

  const increase = useCallback(
    () => setQuantity((value) => Math.min(max, value + 1)),
    [max]
  );

  return (
    <div className="flex items-center gap-5">
      <Label>Quantity</Label>
      <div className="inline-flex h-11 items-center gap-1 rounded-full border border-hairline px-2">
        <button
          aria-label="One fewer"
          className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone disabled:opacity-40"
          disabled={quantity === 1}
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
          disabled={quantity === max}
          onClick={increase}
          type="button"
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export { QuantityStepper };
