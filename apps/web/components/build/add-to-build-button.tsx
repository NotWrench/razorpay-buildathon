"use client";

import { Button } from "@workspace/ui/components/button";
import { WrenchIcon } from "lucide-react";
import { useCallback } from "react";
import { useAction } from "@/hooks/use-action";
import { setBuildPartAction } from "@/lib/actions/build";

/**
 * Puts a part into the shopper's build, starting one if there isn't one yet.
 *
 * The action revalidates on the server, so this holds no copy of the build —
 * it only knows whether a call is in flight.
 */
export function AddToBuildButton({
  buildId,
  className,
  productId,
  slug,
}: {
  /** Null when the shopper has not started a build yet. */
  buildId: string | null;
  className?: string;
  productId: string;
  slug: string;
}) {
  const { pending, run } = useAction(setBuildPartAction, {
    successMessage: "Added to your build",
  });

  const add = useCallback(
    () => run({ buildId: buildId ?? undefined, productId, slug }),
    [buildId, productId, run, slug]
  );

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={add}
      variant="outline"
    >
      <WrenchIcon />
      Add to build
    </Button>
  );
}
