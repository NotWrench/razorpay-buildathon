"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Shimmer } from "@workspace/ui/components/motion/shimmer";
import { Pill } from "@workspace/ui/components/pill";
import { PriceBlock } from "@workspace/ui/components/price-block";
import { SpecList } from "@workspace/ui/components/spec-list";
import { StatusLine } from "@workspace/ui/components/status-line";
import type { CategorySlug } from "@workspace/db/taxonomy";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ProductRender } from "@/components/common/product-render";
import { slotCandidatesAction } from "@/lib/actions/slot";
import type { ProductSummary } from "@/lib/data/types";

/**
 * Choosing the part that goes in one slot.
 *
 * The list is filtered by the compatibility engine rather than by a guess:
 * `slotCandidatesAction` asks `getCatalog` with `compatibleOnly`, which runs
 * the same rules the build page reports against. "Only what fits" defaults on
 * once there is something to fit against, and can be turned off — a shopper
 * who wants to see the part that does not fit is allowed to, and the row will
 * then say why.
 */

interface SlotPickerProps {
  category: CategorySlug;
  hasBuild: boolean;
  onChoose: (productId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  slotName: string;
}

function Candidate({
  disabled,
  onChoose,
  product,
}: {
  disabled: boolean;
  onChoose: (productId: string) => void;
  product: ProductSummary;
}) {
  const choose = useCallback(
    () => onChoose(product.id),
    [onChoose, product.id]
  );

  return (
    <div className="flex flex-col surface-card rounded-[20px] border border-hairline bg-panel p-5">
      <ImageGround className="aspect-[16/10] p-6">
        <ProductRender
          alt={product.name}
          category={product.category}
          src={product.imageUrl || undefined}
        />
      </ImageGround>

      <Label className="mt-5">{product.brand}</Label>
      <h3 className="t-body mt-2 line-clamp-2 min-h-[44px] font-medium text-bone">
        {product.name}
      </h3>

      <SpecList className="mt-4" rows={product.keySpecs} />
      <PriceBlock
        className="mt-4"
        compareAtPaise={product.compareAtPaise}
        pricePaise={product.pricePaise}
        size="sm"
      />

      {product.stock === "out_of_stock" ? (
        <StatusLine
          className="mt-3"
          message="Out of stock."
          state="incompatible"
        />
      ) : null}

      {/* Ghost, not solid: a grid of twenty-four filled red pills is how red
          stops meaning anything. The one solid pill on this screen is the
          compatibility filter, which is the only choice that changes what is
          on offer. */}
      <Pill
        className="mt-5 w-full justify-center"
        disabled={disabled || product.stock === "out_of_stock"}
        onClick={choose}
        size="sm"
        variant="ghost"
      >
        Use this
      </Pill>
    </div>
  );
}

function SlotPicker({
  category,
  hasBuild,
  onChoose,
  onOpenChange,
  open,
  pending,
  slotName,
}: SlotPickerProps) {
  const [items, setItems] = useState<ProductSummary[] | null>(null);
  const [onlyFitting, setOnlyFitting] = useState(hasBuild);
  const [query, setQuery] = useState("");
  const [loading, startLoading] = useTransition();

  /*
   * Reloading on every keystroke would put the catalogue query on the same
   * footing as the typing. The dialog waits for the shopper to stop.
   */
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query), 220);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    startLoading(async () => {
      const result = await slotCandidatesAction({
        category,
        compatibleOnly: onlyFitting && hasBuild,
        query: term,
      });

      setItems(result.ok ? result.data : []);
    });
  }, [category, hasBuild, onlyFitting, open, term]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const toggleFitting = useCallback(() => setOnlyFitting((on) => !on), []);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-exit data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-71 flex h-[86vh] w-[1120px] max-w-[94vw] flex-col rounded-[28px] bg-carbon shadow-float transition-[opacity,transform] duration-standard ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:scale-[0.98] data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:opacity-0">
          <div className="flex flex-wrap items-center justify-between gap-4 px-8 pt-8 pb-6">
            <div>
              <Label>Choose</Label>
              <Dialog.Title className="t-display-sm mt-2 text-bone">
                {slotName}
              </Dialog.Title>
            </div>

            <div className="flex items-center gap-3">
              <input
                aria-label={`Search ${slotName}`}
                className="t-body h-11 w-[240px] max-w-[50vw] rounded-full border border-hairline bg-transparent px-5 text-bone placeholder:text-smoke focus:border-smoke focus:outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                value={query}
              />
              {hasBuild ? (
                <Pill
                  aria-pressed={onlyFitting}
                  onClick={toggleFitting}
                  size="sm"
                  variant={onlyFitting ? "solid" : "ghost"}
                >
                  Only what fits
                </Pill>
              ) : null}
              <Pill onClick={close} size="sm" variant="text">
                Close
              </Pill>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-8">
            {loading || items === null ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((slot) => (
                  <Shimmer className="h-[380px] rounded-[20px]" key={slot} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-24 text-center">
                <p className="t-display-sm text-bone">Nothing here fits yet.</p>
                <p className="t-body mx-auto mt-3 max-w-[46ch] text-smoke">
                  {onlyFitting
                    ? "Every part in this slot conflicts with something already chosen. Turn off “Only what fits” to see them all, or change the part it clashes with."
                    : "No parts match that search."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product) => (
                  <Candidate
                    disabled={pending}
                    key={product.id}
                    onChoose={onChoose}
                    product={product}
                  />
                ))}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { SlotPicker };
