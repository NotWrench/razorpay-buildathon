"use client";

import { Menu } from "@base-ui/react/menu";
import type { CategorySlug } from "@workspace/db/taxonomy";
import { ImageGround } from "@workspace/ui/components/image-ground";
import { KenBurns } from "@workspace/ui/components/motion/ken-burns";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, X } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";
import { ProductRender } from "@/components/common/product-render";
import type { ProductSort } from "@/lib/data/types";
import { PRODUCT_SORTS, SORT_LABELS } from "@/lib/data/types";

/**
 * The head of a category page: a wide, low strip of that category's hardware
 * with the name over it, the count, and the two controls that change what the
 * grid shows.
 */

interface ActiveFilter {
  key: string;
  label: string;
  /** What the query string becomes when this pill's × is pressed. */
  remove: () => void;
}

interface CategoryBandProps {
  activeFilters: ActiveFilter[];
  category?: CategorySlug;
  filterCount: number;
  /**
   * This page's hero, already resolved. Client component, so the shop page
   * does the filesystem lookup — see `lib/landing-images.ts`.
   */
  heroSrc?: string;
  name: string;
  onOpenFilters: () => void;
  onSort: (sort: ProductSort) => void;
  sort: ProductSort;
  /** Undefined until the query answers — a loading shelf has no count. */
  total?: number;
}

function FilterPill({ filter }: { filter: ActiveFilter }) {
  return (
    <button
      className="t-body-sm inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-4 text-smoke transition-colors duration-micro hover:border-smoke hover:text-bone"
      onClick={filter.remove}
      type="button"
    >
      {filter.label}
      <X aria-hidden className="size-3" />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}

function SortItem({
  onSort,
  value,
}: {
  onSort: (sort: ProductSort) => void;
  value: ProductSort;
}) {
  const handleClick = useCallback(() => onSort(value), [onSort, value]);

  return (
    <Menu.Item
      className="t-body rounded-[16px] px-4 py-2.5 text-bone outline-none transition-colors duration-micro data-highlighted:bg-riser"
      onClick={handleClick}
    >
      {SORT_LABELS[value]}
    </Menu.Item>
  );
}

/**
 * What the banner shows: this page's photograph if it has been shot, else the
 * one line drawing for a category page, else the row of three that stands for
 * "everything".
 */
function BandArt({
  category,
  heroSrc,
}: {
  category?: CategorySlug;
  heroSrc?: string;
}) {
  if (heroSrc) {
    return (
      <Image alt="" className="object-cover" fill sizes="100vw" src={heroSrc} />
    );
  }

  if (category) {
    return <ProductRender alt="" category={category} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center gap-10 opacity-80">
      <ProductRender alt="" category="gpu" />
      <ProductRender alt="" category="cpu" />
      <ProductRender alt="" category="storage" />
    </div>
  );
}

function CategoryBand({
  activeFilters,
  category,
  filterCount,
  name,
  onOpenFilters,
  onSort,
  sort,
  heroSrc,
  total,
}: CategoryBandProps) {
  return (
    <section>
      {/*
          A banner is the one slot where cropping is the point: a 3:1 studio
          shot into a band this wide keeps the middle and loses the top and
          bottom, which is what a banner does. The height grows with the
          viewport so that crop, and the upscale that comes with it, both ease
          off on a wide screen.
        */}
      <div className="relative h-[220px] w-full overflow-hidden sm:h-[260px] lg:h-[300px] xl:h-[340px]">
        <KenBurns className="h-full w-full">
          <ImageGround
            className={cn(
              "h-full w-full rounded-none",
              heroSrc ? undefined : "p-6"
            )}
          >
            <BandArt category={category} heroSrc={heroSrc} />
          </ImageGround>
        </KenBurns>
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--void)_30%,transparent)_45%,color-mix(in_srgb,var(--void)_94%,transparent)_100%)]"
        />
      </div>

      <div className="mx-auto w-full max-w-[1280px] px-8 lg:px-16">
        <div className="relative -mt-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="t-display-lg text-bone leading-none">{name}</h1>
            <p className="t-num-xs mt-3 h-5 text-smoke">
              {total === undefined
                ? null
                : `${total} ${total === 1 ? "part" : "parts"}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Pill onClick={onOpenFilters} size="sm" variant="ghost">
              Filter
              {filterCount > 0 ? (
                <span className="t-num-xs">{filterCount}</span>
              ) : null}
            </Pill>

            <Menu.Root>
              <Menu.Trigger className="t-body flex items-center gap-1.5 text-smoke transition-colors duration-micro hover:text-bone data-popup-open:text-bone">
                {SORT_LABELS[sort]}
                <ChevronDown aria-hidden className="size-3.5" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner align="end" side="bottom" sideOffset={12}>
                  <Menu.Popup className="w-[240px] rounded-[28px] bg-panel p-2 shadow-float outline-none">
                    {PRODUCT_SORTS.map((value) => (
                      <SortItem key={value} onSort={onSort} value={value} />
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {activeFilters.map((filter) => (
              <FilterPill filter={filter} key={filter.key} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export type { ActiveFilter };
export { CategoryBand };
