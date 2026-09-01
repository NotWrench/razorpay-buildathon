"use client";

import { useMemo } from "react";
import {
  addBuildToCartAction,
  addToCartAction,
  removeFromCartAction,
} from "@/lib/actions/cart";
import { useAction } from "./use-action";

/**
 * The three things a page does to a cart, bound to one store.
 *
 * Every add/remove control in the app goes through here rather than importing
 * the actions directly, so the slug is threaded once and the pending state is
 * consistent wherever a line is being changed.
 */
export function useCartActions(slug: string) {
  const add = useAction(addToCartAction, { successMessage: "Added to cart" });
  const remove = useAction(removeFromCartAction);
  const addBuild = useAction(addBuildToCartAction, {
    successMessage: "Build added to cart",
  });

  return useMemo(
    () => ({
      addBuild: (buildId: string) => addBuild.run({ buildId, slug }),
      addProduct: (productId: string, quantity = 1, buildId?: string) =>
        add.run({ buildId, productId, quantity, slug }),
      pending: add.pending || remove.pending || addBuild.pending,
      removeProduct: (
        productId: string,
        options?: { buildId?: string; quantity?: number }
      ) =>
        remove.run({
          buildId: options?.buildId,
          productId,
          quantity: options?.quantity,
          slug,
        }),
    }),
    [add, addBuild, remove, slug]
  );
}
