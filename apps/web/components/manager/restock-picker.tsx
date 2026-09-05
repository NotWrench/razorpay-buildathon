"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { ProductRender } from "@/components/common/product-render";
import { ManagerSearch } from "@/components/manager/manager-search";
import type { ManagerProduct } from "@/lib/data/types";

/**
 * Putting something on the order that the threshold rule did not catch.
 *
 * The list is only what is running low, which is the right default and the
 * wrong only option — an operator who knows a part is about to move has no way
 * to say so. This is that way.
 *
 * Same sheet as the product editor: 480px from the right edge, carbon,
 * rounded on the left corners only. It stays open after an add, because
 * putting three things on one order should not be three round trips.
 */

function QuantityInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(Math.max(1, Number(event.target.value) || 0)),
    [onChange]
  );

  return (
    <input
      aria-label={label}
      className="t-num-sm h-9 w-16 shrink-0 rounded-full border border-hairline bg-transparent px-3 text-right text-bone outline-none transition-colors duration-micro focus:border-bone"
      inputMode="numeric"
      onChange={change}
      value={value}
    />
  );
}

function PickerRow({
  entry,
  onAdd,
}: {
  entry: ManagerProduct;
  onAdd: (entry: ManagerProduct, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(10);

  const add = useCallback(
    () => onAdd(entry, quantity),
    [entry, onAdd, quantity]
  );

  const low = entry.stock <= entry.lowAt;

  return (
    <div className="flex items-center gap-3 py-3">
      <ImageGround className="size-10 shrink-0 rounded-[10px] p-1.5">
        <ProductRender
          alt=""
          category={entry.product.category}
          sizes="40px"
          src={entry.product.imageUrl || undefined}
        />
      </ImageGround>

      <div className="min-w-0 flex-1">
        <p className="t-body-sm truncate text-bone">{entry.product.name}</p>
        <p className={cn("t-num-xs mt-1", low ? "text-amber" : "text-smoke")}>
          {entry.stock} on hand
        </p>
      </div>

      <QuantityInput
        label={`Units of ${entry.product.name}`}
        onChange={setQuantity}
        value={quantity}
      />

      <Pill onClick={add} size="sm" variant="ghost">
        Add
      </Pill>
    </div>
  );
}

function RestockPicker({
  catalogue,
  onAdd,
  onOpenChange,
  open,
}: {
  /** Already filtered to what is not on the order yet. */
  catalogue: ManagerProduct[];
  onAdd: (entry: ManagerProduct, quantity: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return catalogue;
    }

    return catalogue.filter((entry) =>
      [entry.product.name, entry.product.brand, entry.product.category].some(
        (field) => field.toLowerCase().includes(needle)
      )
    );
  }, [catalogue, query]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-71 flex w-[480px] max-w-[92vw] flex-col rounded-l-[28px] bg-carbon shadow-float transition-transform duration-standard ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:translate-x-full data-starting-style:translate-x-full data-ending-style:duration-exit data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
          <div className="flex items-center justify-between px-7 pt-7 pb-5">
            <Dialog.Title className="t-display-sm text-bone">
              Add to restock
            </Dialog.Title>
            <Dialog.Close
              className="t-body-sm text-smoke transition-colors duration-micro hover:text-bone"
              render={<button type="button" />}
            >
              Close
            </Dialog.Close>
          </div>

          <div className="px-7 pb-4">
            <ManagerSearch
              label="Search the catalogue"
              onValueChange={setQuery}
              placeholder="Name, brand, category"
              value={query}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-7 pb-7">
            {shown.length === 0 ? (
              <p className="t-body-sm py-10 text-smoke">
                {catalogue.length === 0
                  ? "Everything in the catalogue is already on this order."
                  : "Nothing in the catalogue matches that."}
              </p>
            ) : (
              <>
                <Label>{shown.length} available</Label>
                <div className="mt-2">
                  {shown.map((entry) => (
                    <PickerRow
                      entry={entry}
                      key={entry.product.id}
                      onAdd={onAdd}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { RestockPicker };
