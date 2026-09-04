"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { ImagePlus } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useId } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { ManagerProduct } from "@/lib/data/types";

/**
 * Adding a product and editing one are the same sheet.
 *
 * It slides on transform from the right edge — 480px, carbon, rounded on the
 * left corners only, because the right corners are off the screen and rounding
 * them would be drawing a card that is pretending to float.
 *
 * The one solid pill in here is Save, which is the whole reason the sheet is
 * open.
 *
 * It is a real form. The fields were uncontrolled inputs with no names, which
 * looked identical and could not be read — Save had nothing to save. Values
 * come off `FormData` on submit rather than out of five pieces of state,
 * because the sheet is discarded on close and state that outlives nothing is
 * state for its own sake.
 */

export interface ProductDraft {
  brand: string;
  category: string;
  name: string;
  pricePaise: number;
  stock: number;
}

const PAISE_PER_RUPEE = 100;

function Field({
  defaultValue,
  label,
  mono,
  name,
  placeholder,
  required,
  step,
  type,
}: {
  defaultValue?: string;
  label: string;
  mono?: boolean;
  name: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: string;
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
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </div>
  );
}

function ProductSheet({
  busy,
  entry,
  onOpenChange,
  onSave,
  open,
}: {
  busy: boolean;
  /** Absent when the sheet is adding rather than editing. */
  entry: ManagerProduct | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ProductDraft) => void;
  open: boolean;
}) {
  const editing = entry !== null;

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);
      const read = (key: string) => String(form.get(key) ?? "").trim();

      /*
       * Rupees in, paise out, rounded once. The field takes rupees because
       * that is what a merchant types; the system stores paise everywhere, and
       * a float that never gets rounded is how ₹3,869.91 becomes 386990.99999.
       */
      const pricePaise = Math.round(
        Number(read("price") || 0) * PAISE_PER_RUPEE
      );

      onSave({
        brand: read("brand"),
        category: read("category"),
        name: read("name"),
        pricePaise,
        stock: Math.max(0, Math.round(Number(read("stock") || 0))),
      });
    },
    [onSave]
  );

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-71 flex w-[480px] max-w-[92vw] flex-col rounded-l-[28px] bg-carbon shadow-float transition-transform duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:translate-x-full data-starting-style:translate-x-full data-ending-style:duration-[280ms] data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
          {/*
            Keyed on the product so switching which row is being edited
            remounts the fields. Without it the defaultValues of the first
            product edited would persist into the second.
          */}
          <form
            className="flex min-h-0 flex-1 flex-col"
            key={entry?.product.id ?? "new"}
            onSubmit={submit}
          >
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
                          Renders come from the category, not an upload
                        </span>
                      </>
                    )}
                  </ImageGround>
                </div>

                <Field
                  defaultValue={entry?.product.name}
                  label="Name"
                  name="name"
                  placeholder="GeForce RTX 5080 Founders Edition"
                  required
                />
                <Field
                  defaultValue={entry?.product.brand}
                  label="Brand"
                  name="brand"
                  placeholder="NVIDIA"
                />
                <Field
                  defaultValue={entry?.product.category}
                  label="Category"
                  name="category"
                  placeholder="gpu"
                />
                <Field
                  defaultValue={
                    entry
                      ? String(entry.product.pricePaise / PAISE_PER_RUPEE)
                      : undefined
                  }
                  label="Price in rupees"
                  mono
                  name="price"
                  placeholder="0"
                  required
                  step="0.01"
                  type="number"
                />
                <Field
                  defaultValue={entry ? String(entry.stock) : undefined}
                  label="Stock"
                  mono
                  name="stock"
                  placeholder="0"
                  type="number"
                />
              </div>
            </div>

            <div className="border-hairline border-t px-7 py-6">
              <Pill
                className="w-full justify-center"
                disabled={busy}
                type="submit"
              >
                {busy ? "Saving…" : "Save"}
              </Pill>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { ProductSheet };
