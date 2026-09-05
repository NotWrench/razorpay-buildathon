"use client";

import type { BuildValidation } from "@workspace/commerce/compatibility";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ShoppingCartIcon } from "lucide-react";
import { Money } from "@/components/common/money";
import { useCartActions } from "@/hooks/use-cart-actions";

/**
 * What the build costs, and the one way it leaves this page.
 *
 * The cart button is disabled while the engine reports a blocking finding —
 * not as the real guard, which lives in `createCheckoutOrderFromCart`, but so
 * the buyer is refused here rather than three steps later at checkout.
 */
export function BuildSummary({
  buildId,
  currency,
  partCount,
  slug,
  subtotalPaise,
  validation,
}: {
  buildId: string | null;
  currency?: string;
  partCount: number;
  slug: string;
  subtotalPaise: number;
  validation: BuildValidation;
}) {
  const { addBuild, pending } = useCartActions(slug);

  const blocked = !validation.canCheckout;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your build</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">
            {partCount} part(s)
          </span>
          <Money currency={currency} paise={subtotalPaise} size="lg" />
        </div>

        <Button
          className="w-full"
          disabled={!buildId || blocked || partCount === 0 || pending}
          onClick={() => buildId && addBuild(buildId)}
        >
          <ShoppingCartIcon />
          Add build to cart
        </Button>

        {blocked && partCount > 0 ? (
          <p className="text-destructive text-xs">
            Resolve the blocking findings before ordering this build.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Prices are re-checked against live stock when the order is created.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
