"use client";

import type { CategorySlug } from "@workspace/db/taxonomy";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import { Pill } from "@workspace/ui/components/pill";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AssistantDock } from "@/components/dock/assistant-dock";
import { ComponentCard } from "@/components/product/component-card";
import type { ActiveFilter } from "@/components/shop/category-band";
import { CategoryBand } from "@/components/shop/category-band";
import {
  type CategoryTile,
  CategoryTiles,
} from "@/components/shop/category-tiles";
import { FilterSheet } from "@/components/shop/filter-sheet";
import type { CatalogPage, ProductSort } from "@/lib/data/types";
import { route } from "@/lib/routes";
import type { ShopParams } from "@/lib/shop-params";
import { countActiveFilters } from "@/lib/shop-params";

/**
 * The interactive half of the shelf.
 *
 * It owns exactly two pieces of state — how many cards are shown, and whether
 * the sheet is open. Everything else is the URL, and every filter is one
 * `replace(..., scroll: false)`: a soft navigation that re-runs the query on
 * the server and leaves the reader where they were.
 */

const PAGE_SIZE = 9;

interface ShopClientProps {
  category?: CategorySlug;
  /** Empty on a category page, where the tiles are not drawn. */
  categoryTiles: CategoryTile[];
  /** Resolved by the server page; this component cannot touch the disk. */
  heroSrc?: string;
  name: string;
  page: CatalogPage;
  params: ShopParams;
  pathname: string;
  query: string;
}

function ShopClient({
  name,
  category,
  categoryTiles,
  heroSrc,
  page,
  params,
  pathname,
  query,
}: ShopClientProps) {
  const router = useRouter();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);

  const onChange = useCallback(
    (patch: Partial<Record<string, string | null>>) => {
      const next = new URLSearchParams(query);

      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      const search = next.toString();

      setShown(PAGE_SIZE);
      router.replace(route(`${pathname}${search ? `?${search}` : ""}`), {
        scroll: false,
      });
    },
    [pathname, query, router]
  );

  const onClear = useCallback(() => {
    const next = new URLSearchParams(query);

    for (const key of [
      "brand",
      "build",
      "inStock",
      "max",
      "min",
      "q",
      "spec",
    ]) {
      next.delete(key);
    }

    const search = next.toString();

    setShown(PAGE_SIZE);
    router.replace(route(`${pathname}${search ? `?${search}` : ""}`), {
      scroll: false,
    });
  }, [pathname, query, router]);

  const onSort = useCallback(
    (sort: ProductSort) => onChange({ sort }),
    [onChange]
  );

  const onOpenFilters = useCallback(() => setSheetOpen(true), []);
  const onLoadMore = useCallback(
    () => setShown((count) => count + PAGE_SIZE),
    []
  );

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (params.compatibleOnly) {
      filters.push({
        key: "build",
        label: "Compatible with my build",
        remove: () => onChange({ build: null }),
      });
    }

    if (params.inStockOnly) {
      filters.push({
        key: "inStock",
        label: "In stock only",
        remove: () => onChange({ inStock: null }),
      });
    }

    if (params.minRupees !== undefined || params.maxRupees !== undefined) {
      const from = (params.minRupees ?? page.priceFloorRupees).toLocaleString(
        "en-IN"
      );
      const to = (params.maxRupees ?? page.priceCeilingRupees).toLocaleString(
        "en-IN"
      );

      filters.push({
        key: "price",
        label: `₹${from} – ₹${to}`,
        remove: () => onChange({ max: null, min: null }),
      });
    }

    for (const brand of params.brands ?? []) {
      filters.push({
        key: `brand-${brand}`,
        label: brand,
        remove: () =>
          onChange({
            brand:
              (params.brands ?? [])
                .filter((entry) => entry !== brand)
                .join(",") || null,
          }),
      });
    }

    for (const spec of params.specs ?? []) {
      filters.push({
        key: `spec-${spec}`,
        label: spec.split(":").slice(1).join(":"),
        remove: () =>
          onChange({
            spec:
              (params.specs ?? [])
                .filter((entry) => entry !== spec)
                .join(",") || null,
          }),
      });
    }

    return filters;
  }, [onChange, page.priceCeilingRupees, page.priceFloorRupees, params]);

  const items = page.items.slice(0, shown);
  const hasMore = page.total > items.length;
  /** One click each, and each one relaxes the nearest thing in the way. */
  const relaxations = activeFilters.slice(0, 3);

  return (
    <>
      <CategoryBand
        activeFilters={activeFilters}
        category={category}
        filterCount={countActiveFilters(params)}
        heroSrc={heroSrc}
        name={name}
        onOpenFilters={onOpenFilters}
        onSort={onSort}
        sort={params.sort ?? "newest"}
        total={page.total}
      />

      {category ? null : <CategoryTiles tiles={categoryTiles} />}

      <div className="mx-auto w-full max-w-[1280px] px-8 pt-12 lg:px-16">
        {items.length === 0 ? (
          <div className="py-24">
            <p className="t-body-lg text-bone">
              Nothing in {name.toLowerCase()} matches those filters.
            </p>
            {relaxations.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {relaxations.map((filter) => (
                  <Pill
                    key={filter.key}
                    onClick={filter.remove}
                    size="sm"
                    variant="ghost"
                  >
                    Without {filter.label.toLowerCase()}
                  </Pill>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <Stagger
              className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3"
              key={query}
            >
              {items.map((product) => (
                <ComponentCard key={product.id} product={product} />
              ))}
            </Stagger>

            {hasMore ? (
              <div className="mt-14 flex justify-center">
                <Pill onClick={onLoadMore} variant="ghost">
                  Load more
                </Pill>
              </div>
            ) : null}
          </>
        )}
      </div>

      <AssistantDock
        context={{ page: "search", searchQuery: category ?? params.query }}
        contextLabel={name}
      />

      <FilterSheet
        onChange={onChange}
        onClear={onClear}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        page={page}
        params={params}
      />
    </>
  );
}

export { ShopClient };
