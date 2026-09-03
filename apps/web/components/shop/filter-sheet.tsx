"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback } from "react";
import { PriceRange } from "@/components/shop/price-range";
import type { CatalogPage, Facet } from "@/lib/data/types";
import type { ShopParams } from "@/lib/shop-params";

/**
 * The filter sheet — a left panel, because that is what buys the grid its
 * width.
 *
 * "Compatible with my build" sits alone above a hairline with real space
 * around it. Everything else in here is a normal facet; that one is what the
 * compatibility engine earns, and putting it in the list with the others would
 * throw the only interesting control on the page away.
 */

interface FilterSheetProps {
  onChange: (patch: Partial<Record<string, string | null>>) => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  page: CatalogPage;
  params: ShopParams;
}

function FacetRow({
  active,
  facet,
  onToggle,
  prefix,
}: {
  active: boolean;
  facet: Facet;
  onToggle: (value: string) => void;
  /** Spec facets carry their label, so "Memory:16GB" stays unambiguous. */
  prefix?: string;
}) {
  const handleClick = useCallback(
    () => onToggle(prefix ? `${prefix}:${facet.value}` : facet.value),
    [facet.value, onToggle, prefix]
  );

  return (
    <li>
      <button
        className={cn(
          "flex w-full items-center justify-between gap-4 border-hairline border-b px-3 py-3 text-left transition-colors duration-[180ms] hover:bg-panel",
          active && "bg-panel"
        )}
        onClick={handleClick}
        type="button"
      >
        <span
          className={cn("text-[15px]", active ? "text-bone" : "text-smoke")}
        >
          {facet.value}
        </span>
        <span className="font-mono text-[13px] text-smoke tabular-nums">
          {facet.count}
        </span>
      </button>
    </li>
  );
}

function Toggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "inline-flex h-11 items-center gap-3 rounded-full border px-5 text-[15px] transition-colors duration-[180ms]",
        checked
          ? "border-smoke bg-panel text-bone"
          : "border-hairline text-smoke hover:border-smoke"
      )}
      onClick={onToggle}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full transition-colors duration-[180ms]",
          checked ? "bg-verdant" : "bg-hairline"
        )}
      />
      {label}
    </button>
  );
}

function FilterSheet({
  onChange,
  onClear,
  onOpenChange,
  open,
  page,
  params,
}: FilterSheetProps) {
  const floor = page.priceFloorRupees;
  const ceiling = page.priceCeilingRupees;

  const range = {
    max: params.maxRupees ?? ceiling,
    min: params.minRupees ?? floor,
  };

  const onRange = useCallback(
    (next: { max: number; min: number }) => {
      onChange({
        max: next.max === ceiling ? null : String(next.max),
        min: next.min === floor ? null : String(next.min),
      });
    },
    [ceiling, floor, onChange]
  );

  const onBuild = useCallback(
    () => onChange({ build: params.compatibleOnly ? null : "1" }),
    [onChange, params.compatibleOnly]
  );

  const onStock = useCallback(
    () => onChange({ inStock: params.inStockOnly ? null : "1" }),
    [onChange, params.inStockOnly]
  );

  const onBrand = useCallback(
    (brand: string) => {
      const current = params.brands ?? [];
      const next = current.includes(brand)
        ? current.filter((entry) => entry !== brand)
        : [...current, brand];

      onChange({ brand: next.length ? next.join(",") : null });
    },
    [onChange, params.brands]
  );

  const onSpec = useCallback(
    (entry: string) => {
      const current = params.specs ?? [];
      const next = current.includes(entry)
        ? current.filter((value) => value !== entry)
        : [...current, entry];

      onChange({ spec: next.length ? next.join(",") : null });
    },
    [onChange, params.specs]
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-void/55 backdrop-blur-[4px] transition-opacity duration-[280ms] data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-71 flex w-[380px] max-w-[92vw] flex-col rounded-r-[28px] bg-carbon shadow-float transition-transform duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] data-ending-style:-translate-x-full data-starting-style:-translate-x-full data-ending-style:duration-[280ms] data-ending-style:ease-[cubic-bezier(.65,0,.35,1)]">
          <div className="flex items-center justify-between px-7 pt-7 pb-6">
            <Dialog.Title className="font-display font-semibold text-[24px] text-bone tracking-[-0.02em]">
              Filter
            </Dialog.Title>
            <Pill onClick={close} size="sm" variant="text">
              Close
            </Pill>
          </div>

          <div className="flex-1 overflow-y-auto px-7 pb-6">
            {/* The toggle only appears when there is a build to filter
                against. A control that silently matches everything is worse
                than one that is not offered. */}
            {page.buildName ? (
              <div className="border-hairline border-b pb-8">
                <Toggle
                  checked={Boolean(params.compatibleOnly)}
                  label="Compatible with my build"
                  onToggle={onBuild}
                />
                <p className="mt-3 text-[13px] text-smoke">{page.buildName}</p>
                {params.compatibleOnly ? (
                  <p className="mt-2 font-mono text-[13px] text-smoke tabular-nums">
                    {page.total} of {page.buildCompatible}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8">
              <PriceRange
                ceiling={ceiling}
                floor={floor}
                onCommit={onRange}
                value={range}
              />
            </div>

            <div className="mt-8">
              <Toggle
                checked={Boolean(params.inStockOnly)}
                label="In stock only"
                onToggle={onStock}
              />
            </div>

            {page.brands.length > 1 ? (
              <div className="mt-8">
                <Label>Brand</Label>
                <ul className="mt-3 border-hairline border-t">
                  {page.brands.map((facet) => (
                    <FacetRow
                      active={Boolean(params.brands?.includes(facet.value))}
                      facet={facet}
                      key={facet.value}
                      onToggle={onBrand}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {page.specs.map((spec) =>
              spec.values.length > 1 ? (
                <div className="mt-8" key={spec.label}>
                  <Label>{spec.label}</Label>
                  <ul className="mt-3 border-hairline border-t">
                    {spec.values.map((facet) => (
                      <FacetRow
                        active={Boolean(
                          params.specs?.includes(`${spec.label}:${facet.value}`)
                        )}
                        facet={facet}
                        key={facet.value}
                        onToggle={onSpec}
                        prefix={spec.label}
                      />
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-hairline border-t px-7 py-5">
            <Pill onClick={onClear} size="sm" variant="text">
              Clear all
            </Pill>
            <Pill onClick={close} size="sm">
              Show {page.total} {page.total === 1 ? "result" : "results"}
            </Pill>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { FilterSheet };
