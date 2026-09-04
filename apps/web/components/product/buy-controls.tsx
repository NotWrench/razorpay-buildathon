"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { setBuildPartAction } from "@/lib/actions/build";
import { addToCartAction } from "@/lib/actions/storefront";
import type { StockState } from "@/lib/data/types";
import { shellRoutes } from "@/lib/routes";

/**
 * Quantity, and the two things you can do with it.
 *
 * The stepper's ceiling is what the store actually has left rather than a
 * round number: a control that lets you ask for nine of something there are
 * two of is a control that exists to produce an error message.
 *
 * "Add to build" adds the same line under the buyer's open build, which is
 * what makes the compatibility strip above it start applying to the basket.
 *
 * With no build open it used to disappear entirely, and nothing in the
 * storefront could start one — so the affordance was invisible until you had
 * been through the assistant. Now the same slot starts a build and opens it,
 * which is a visible effect rather than a silent one.
 */

const HARD_MAX = 9;

interface BuyControlsProps {
  /** The build the shopper has open, if any. */
  buildId?: string;
  buildName?: string;
  onHand: number;
  productId: string;
  /** The store, for the build actions, which are slug-scoped. */
  slug: string;
  stock: StockState;
}

export function BuyControls({
  buildId,
  buildName,
  onHand,
  productId,
  slug,
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

  /*
   * No build yet: `setBuildPartAction` creates one around this part when it is
   * given no build id, so starting a build and choosing its first component
   * are the same click.
   */
  const startBuild = useCallback(() => {
    startTransition(async () => {
      const result = await setBuildPartAction({ productId, slug });

      if (result.ok) {
        toast.success("Build started.");
        router.push(shellRoutes.build);

        return;
      }

      toast.error(result.message);
    });
  }, [productId, router, slug]);

  return (
    <>
      <div className="mt-8 flex items-center gap-5">
        <Label>Quantity</Label>
        <div className="inline-flex h-11 items-center gap-1 rounded-full border border-hairline px-2">
          <button
            aria-label="One fewer"
            className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:text-bone disabled:opacity-40"
            disabled={quantity === 1 || soldOut}
            onClick={decrease}
            type="button"
          >
            <Minus aria-hidden className="size-3.5" />
          </button>
          <span className="t-num-sm w-8 text-center text-bone">
            {quantity}
          </span>
          <button
            aria-label="One more"
            className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors duration-micro hover:text-bone disabled:opacity-40"
            disabled={quantity >= max || soldOut}
            onClick={increase}
            type="button"
          >
            <Plus aria-hidden className="size-3.5" />
          </button>
        </div>

        {stock === "low_stock" ? (
          <span className="t-num-xs text-amber">
            {onHand} left
          </span>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Pill disabled={soldOut || pending} onClick={addLoose}>
          {pending ? "Adding…" : "Add to cart"}
        </Pill>

        <Pill
          disabled={soldOut || pending}
          onClick={buildId ? addToBuild : startBuild}
          variant="ghost"
        >
          {buildId ? "Add to build" : "Start a build with this"}
        </Pill>
      </div>
    </>
  );
}
