"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { Row } from "@/components/search/rows";
import type { ProductSummary } from "@/lib/data/types";

/**
 * The rows the overlay is made of.
 *
 * Each one owns its own click handler so the list can hand it a stable
 * callback rather than a fresh closure per render, and each one knows only
 * whether it is the active row — the keyboard walk lives in the overlay.
 */

const ROW_BASE =
  "-ml-3 flex w-full items-center gap-4 border-transparent border-l-2 py-3 pl-3 text-left transition-colors duration-[180ms]";

/*
 * The active row is bone and a lift, not red. Red on this site means "this
 * does something"; the row the keyboard happens to be on is a state.
 */
const ROW_ACTIVE = "border-bone bg-panel";

interface RowProps {
  active: boolean;
  onActivate: (row: Row) => void;
  row: Row;
}

/** A category with its count, or a suggested query. */
function TextRow({
  active,
  count,
  label,
  onActivate,
  row,
}: RowProps & { count?: number; label: string }) {
  const handleClick = useCallback(() => onActivate(row), [onActivate, row]);

  return (
    <li className="border-hairline border-b">
      <button
        className={cn(ROW_BASE, active && ROW_ACTIVE)}
        onClick={handleClick}
        type="button"
      >
        <span className="flex-1 text-[15px] text-bone">{label}</span>
        {count === undefined ? null : (
          <span className="font-mono text-[13px] text-smoke tabular-nums">
            {count}
          </span>
        )}
      </button>
    </li>
  );
}

function ProductTile({
  active,
  onActivate,
  product,
  row,
}: RowProps & { product: ProductSummary }) {
  const handleClick = useCallback(() => onActivate(row), [onActivate, row]);

  return (
    <li>
      <button
        className={cn(
          "block w-full rounded-[20px] border-2 border-transparent p-1 text-left transition-colors duration-[180ms]",
          active && ROW_ACTIVE
        )}
        onClick={handleClick}
        type="button"
      >
        <ImageGround className="aspect-[4/3] p-4">
          <ProductRender alt={product.name} category={product.category} />
        </ImageGround>
        <span className="mt-3 block text-[14px] text-bone">{product.name}</span>
        <span className="mt-1 block font-mono text-[13px] text-smoke tabular-nums">
          {formatPaise(product.pricePaise)}
        </span>
      </button>
    </li>
  );
}

/** The escape hatch for everything keyword search cannot do. */
function AssistantRow({
  active,
  onActivate,
  row,
  term,
}: RowProps & { term: string }) {
  const handleClick = useCallback(() => onActivate(row), [onActivate, row]);

  return (
    <button
      className={cn(ROW_BASE, active && ROW_ACTIVE)}
      onClick={handleClick}
      type="button"
    >
      <Sparkles aria-hidden className="size-4 shrink-0 text-smoke" />
      <span>
        <span className="block text-[15px] text-bone">
          {term ? `Ask the assistant: “${term}”` : "Ask the assistant"}
        </span>
        <span className="mt-1 block text-[13px] text-smoke">
          Compare, check compatibility, or get a recommendation.
        </span>
      </span>
    </button>
  );
}

export { AssistantRow, ProductTile, TextRow };
