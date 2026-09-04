"use client";

import { Pill } from "@workspace/ui/components/pill";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { startBuildFromPartsAction } from "@/lib/actions/build";
import { addBuildToCartAction } from "@/lib/actions/cart";
import { shellRoutes } from "@/lib/routes";

/**
 * The two things you can do with a machine.
 *
 * "Configure" was a `<Pill>` with no `onClick` — the only call to action on
 * the model page, which left four fully-costed machines unpurchasable. Both
 * buttons now go through the same first step: the manifest becomes a real
 * draft build owned by the shopper. From there one route opens the builder
 * and the other puts the parts in the cart, and neither invents a code path
 * that did not already exist.
 */

function ModelActions({
  name,
  productIds,
  slug,
}: {
  name: string;
  productIds: string[];
  slug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"configure" | "cart" | null>(null);

  const seed = useCallback(async () => {
    const result = await startBuildFromPartsAction({ name, productIds, slug });

    if (!result.ok) {
      toast.error(result.message);

      return null;
    }

    return result.data.buildId;
  }, [name, productIds, slug]);

  const configure = useCallback(async () => {
    setBusy("configure");

    const buildId = await seed();

    if (buildId) {
      router.push(shellRoutes.build);
    } else {
      setBusy(null);
    }
  }, [router, seed]);

  const addToCart = useCallback(async () => {
    setBusy("cart");

    const buildId = await seed();

    if (!buildId) {
      setBusy(null);

      return;
    }

    const added = await addBuildToCartAction({ buildId, slug });

    if (added.ok) {
      toast.success(`${name} added to your cart`);
      router.push(shellRoutes.cart);

      return;
    }

    toast.error(added.message);
    setBusy(null);
  }, [name, router, seed, slug]);

  const disabled = busy !== null || productIds.length === 0;

  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <Pill disabled={disabled} onClick={configure}>
        {busy === "configure" ? "Opening…" : "Configure"}
      </Pill>
      <Pill disabled={disabled} onClick={addToCart} variant="ghost">
        {busy === "cart" ? "Adding…" : "Add to cart"}
      </Pill>
    </div>
  );
}

export { ModelActions };
