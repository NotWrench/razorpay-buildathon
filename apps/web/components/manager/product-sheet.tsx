"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { ImagePlus } from "lucide-react";
import { useId } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { ManagerProduct } from "@/lib/mock/types";

/**
 * Adding a product and editing one are the same sheet.
 *
 * It slides on transform from the right edge — 480px, carbon, rounded on the
 * left corners only, because the right corners are off the screen and rounding
 * them would be drawing a card that is pretending to float.
 *
 * The one solid pill in here is Save, which is the whole reason the sheet is
 * open.
 */

function Field({
  defaultValue,
  label,
  mono,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  mono?: boolean;
  placeholder?: string;
}) {
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        className={
          mono
            ? "mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 font-mono text-[15px] text-bone tabular-nums outline-none transition-colors duration-[180ms] focus:border-bone"
            : "mt-2 h-[52px] w-full rounded-full border border-hairline bg-panel px-5 text-[15px] text-bone outline-none transition-colors duration-[180ms] placeholder:text-smoke focus:border-bone"
        }
        defaultValue={defaultValue}
        id={id}
        placeholder={placeholder}
      />
    </div>
  );
}

function ProductSheet({
  entry,
  onOpenChange,
  onSave,
  open,
}: {
  /** Absent when the sheet is adding rather than editing. */
  entry: ManagerProduct | null;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
}) {
  const editing = entry !== null;

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-71 flex w-[480px] max-w-[92vw] flex-col rounded-l-[28px] bg-carbon shadow-float transition-transform duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:translate-x-full data-starting-style:translate-x-full data-ending-style:duration-[280ms] data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
          <div className="flex items-center justify-between px-7 pt-7 pb-6">
            <Dialog.Title className="font-display font-semibold text-[24px] text-bone tracking-[-0.02em]">
              {editing ? "Edit product" : "Add product"}
            </Dialog.Title>
            <Dialog.Close
              className="text-[13px] text-smoke transition-colors duration-[180ms] hover:text-bone"
              render={<button type="button" />}
            >
              Close
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-7 pb-6">
            <div className="grid gap-5">
              <div>
                <Label>Image</Label>
                <ImageGround className="mt-2 flex h-[160px] w-full flex-col items-center justify-center gap-3 rounded-[16px]">
                  {entry ? (
                    <ProductRender
                      alt=""
                      category={entry.product.category}
                      className="h-[70%] w-auto"
                    />
                  ) : (
                    <>
                      <ImagePlus aria-hidden className="size-5 text-smoke" />
                      <span className="text-[13px] text-smoke">
                        Drop a render, or choose a file
                      </span>
                    </>
                  )}
                </ImageGround>
              </div>

              <Field
                defaultValue={entry?.product.name}
                label="Name"
                placeholder="GeForce RTX 5080 Founders Edition"
              />
              <Field
                defaultValue={entry?.product.brand}
                label="Brand"
                placeholder="NVIDIA"
              />
              <Field
                defaultValue={entry?.product.category}
                label="Category"
                placeholder="gpu"
              />
              <Field
                defaultValue={
                  entry ? formatPaise(entry.product.pricePaise) : undefined
                }
                label="Price"
                mono
                placeholder="₹0"
              />
              <Field
                defaultValue={entry ? String(entry.stock) : undefined}
                label="Stock"
                mono
                placeholder="0"
              />
            </div>
          </div>

          <div className="border-hairline border-t px-7 py-6">
            <Pill className="w-full justify-center" onClick={onSave}>
              Save
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { ProductSheet };
