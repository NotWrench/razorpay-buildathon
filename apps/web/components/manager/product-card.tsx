"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { ProductRender } from "@/components/common/product-render";
import { RowAction } from "@/components/manager/manager-table";
import { SelectCell } from "@/components/manager/select-cell";
import type { ManagerProduct } from "@/lib/data/types";

/**
 * One product, as a card.
 *
 * The catalogue was a table of 44px thumbnails, which is the wrong shape for
 * a shop that sells things you look at — five columns of 13px text told you
 * everything except what the part is. The render is the card now, and the
 * three things an operator actually scans for sit under it: price, stock, and
 * whether it is live.
 *
 * The actions reveal on hover *and on focus*, and stay visible below `lg`,
 * because a control that only exists under a pointer does not exist for the
 * keyboard or for a phone.
 */

const CARD_SIZES =
  "(min-width: 1536px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw";

function ProductCard({
  entry,
  onDuplicate,
  onEdit,
  onOrder,
  onRemove,
  onToggle,
  selected,
  selecting,
}: {
  entry: ManagerProduct;
  onDuplicate: (entry: ManagerProduct) => void;
  onEdit: (entry: ManagerProduct) => void;
  onOrder: (entry: ManagerProduct) => void;
  onRemove: (entry: ManagerProduct) => void;
  onToggle: (id: string) => void;
  selected: boolean;
  /** True once anything on the page is selected — the boxes stop hiding. */
  selecting: boolean;
}) {
  const edit = useCallback(() => onEdit(entry), [entry, onEdit]);
  const duplicate = useCallback(() => onDuplicate(entry), [entry, onDuplicate]);
  const order = useCallback(() => onOrder(entry), [entry, onOrder]);
  const remove = useCallback(() => onRemove(entry), [entry, onRemove]);

  const low = entry.stock <= entry.lowAt;
  const { name } = entry.product;

  return (
    <li
      className={cn(
        "group flex flex-col rounded-[20px] border bg-panel p-3 transition-colors duration-micro",
        selected ? "border-bone" : "border-hairline hover:border-smoke"
      )}
    >
      <ImageGround className="aspect-[4/3] w-full rounded-[16px] p-6">
        <ProductRender
          alt=""
          category={entry.product.category}
          sizes={CARD_SIZES}
          src={entry.product.imageUrl || undefined}
        />

        <div
          className={cn(
            "absolute top-3 left-3 transition-opacity duration-micro",
            selected || selecting
              ? "opacity-100"
              : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          )}
        >
          <SelectCell
            checked={selected}
            id={entry.product.id}
            label={`Select ${name}`}
            onToggle={onToggle}
          />
        </div>

        {entry.status === "draft" ? (
          <span className="t-label absolute top-3 right-3 rounded-full border border-hairline bg-void/70 px-2.5 py-1 text-smoke backdrop-blur-[2px]">
            Draft
          </span>
        ) : null}
      </ImageGround>

      <div className="flex flex-1 flex-col px-1.5 pt-4">
        <p className="t-body line-clamp-2 text-bone">{name}</p>
        <Label className="mt-1 block">{entry.product.category}</Label>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="t-num-md text-bone">
            {formatPaise(entry.product.pricePaise)}
          </span>
          <span className={cn("t-num-xs", low ? "text-amber" : "text-smoke")}>
            {entry.stock} in stock
          </span>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 flex items-center justify-end gap-1 border-hairline border-t pt-2.5",
          "transition-opacity duration-micro",
          "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
        )}
      >
        <RowAction label={`Edit ${name}`} onClick={edit}>
          <Pencil aria-hidden className="size-3.5" />
        </RowAction>
        <RowAction label={`Duplicate ${name}`} onClick={duplicate}>
          <Copy aria-hidden className="size-3.5" />
        </RowAction>
        <RowAction label={`Order more ${name}`} onClick={order}>
          <Plus aria-hidden className="size-4" />
        </RowAction>
        <RowAction label={`Remove ${name}`} onClick={remove} tone="lacquer">
          <Trash2 aria-hidden className="size-3.5" />
        </RowAction>
      </div>
    </li>
  );
}

export { ProductCard };
