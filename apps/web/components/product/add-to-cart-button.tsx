"use client";

import { Button } from "@workspace/ui/components/button";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useCartActions } from "@/hooks/use-cart-actions";

/**
 * The one control that puts a product in the basket.
 *
 * It never disables itself optimistically: the server action revalidates and
 * the page re-renders with the real cart, so what the shopper sees after a
 * click is what the database holds — not a guess the UI made.
 */
export function AddToCartButton({
  className,
  disabled,
  label = "Add to cart",
  productId,
  quantity = 1,
  size = "default",
  slug,
  variant = "default",
}: {
  className?: string;
  disabled?: boolean;
  label?: string;
  productId: string;
  quantity?: number;
  size?: "xs" | "sm" | "default" | "lg";
  slug: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const { addProduct, pending } = useCartActions(slug);

  return (
    <Button
      className={className}
      disabled={disabled || pending}
      onClick={() => addProduct(productId, quantity)}
      size={size}
      variant={variant}
    >
      {pending ? <CheckIcon /> : <PlusIcon />}
      {label}
    </Button>
  );
}
