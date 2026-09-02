"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { StatusLine } from "@workspace/ui/components/status-line";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { CartLine } from "@/lib/mock/types";
import { shellRoutes } from "@/lib/routes";

/**
 * One line, as a row on a hairline rather than a card.
 *
 * A cart is a list of things you already decided on; giving each one a card
 * makes the page look like a shelf you are still browsing.
 */

interface CartRowProps {
  exiting: boolean;
  line: CartLine;
  onQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  register: (key: string, node: HTMLElement | null) => void;
  rowKey: string;
}

function CartRow({
  exiting,
  line,
  onQuantity,
  onRemove,
  register,
  rowKey,
}: CartRowProps) {
  const handleRef = useCallback(
    (node: HTMLLIElement | null) => register(rowKey, node),
    [register, rowKey]
  );

  const decrease = useCallback(
    () => onQuantity(rowKey, Math.max(1, line.quantity - 1)),
    [line.quantity, onQuantity, rowKey]
  );

  const increase = useCallback(
    () => onQuantity(rowKey, Math.min(9, line.quantity + 1)),
    [line.quantity, onQuantity, rowKey]
  );

  const remove = useCallback(() => onRemove(rowKey), [onRemove, rowKey]);

  return (
    <li
      className={cn(
        "border-hairline border-b py-6 transition-opacity duration-[280ms]",
        exiting && "pointer-events-none opacity-0"
      )}
      ref={handleRef}
    >
      <div className="flex flex-wrap items-center gap-5">
        <ImageGround className="size-[72px] shrink-0 rounded-[12px] p-3">
          <ProductRender alt="" category={line.product.category} />
        </ImageGround>

        <div className="min-w-0 flex-1">
          <Link
            className="text-[15px] text-bone transition-colors duration-[180ms] hover:text-smoke"
            href={shellRoutes.product(line.product.id)}
          >
            {line.product.name}
          </Link>
          <Label className="mt-1 block">{line.product.brand}</Label>
        </div>

        <span className="w-28 text-right font-mono text-[13px] text-smoke tabular-nums">
          {formatPaise(line.product.pricePaise)}
        </span>

        <div className="inline-flex h-10 items-center gap-1 rounded-full border border-hairline px-2">
          <button
            aria-label={`One fewer ${line.product.name}`}
            className="flex size-7 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone disabled:opacity-40"
            disabled={line.quantity === 1}
            onClick={decrease}
            type="button"
          >
            <Minus aria-hidden className="size-3.5" />
          </button>
          <span className="w-7 text-center font-mono text-[15px] text-bone tabular-nums">
            {line.quantity}
          </span>
          <button
            aria-label={`One more ${line.product.name}`}
            className="flex size-7 items-center justify-center rounded-full text-smoke transition-colors duration-[180ms] hover:text-bone disabled:opacity-40"
            onClick={increase}
            type="button"
          >
            <Plus aria-hidden className="size-3.5" />
          </button>
        </div>

        <span className="w-32 text-right font-mono text-[15px] text-bone tabular-nums">
          {formatPaise(line.product.pricePaise * line.quantity)}
        </span>

        <Pill onClick={remove} size="sm" variant="text">
          Remove
        </Pill>
      </div>

      {line.issue ? (
        <StatusLine
          className="mt-3 pl-[92px]"
          message={line.issue.message}
          state={line.issue.state}
        />
      ) : null}
    </li>
  );
}

export { CartRow };
