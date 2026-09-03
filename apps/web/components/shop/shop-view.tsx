"use client";

import type { CategorySlug } from "@workspace/db/taxonomy";
import { Label } from "@workspace/ui/components/label";
import { Stagger } from "@workspace/ui/components/motion/stagger";
import { Pill } from "@workspace/ui/components/pill";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComponentCard,
  ComponentCardSkeleton,
} from "@/components/product/component-card";
import type { ActiveFilter } from "@/components/shop/category-band";
import { CategoryBand } from "@/components/shop/category-band";
import { FilterSheet } from "@/components/shop/filter-sheet";
import { getCatalog } from "@/lib/mock";
import type { CatalogPage, ProductSort } from "@/lib/mock/catalog";
import { countActiveFilters, parseShopParams } from "@/lib/shop-params";

/**
 * The shop page's one client component.
 *
 * Filters live in the URL — a filtered shelf is a thing you send someone — and
 * are written with `replace(scroll: false)` so the grid updates without a
 * navigation and without the page jumping to the top.
 */

const PAGE_SIZE = 9;
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

type Status = "loading" | "ready" | "error";

interface ShopViewProps {
  category?: CategorySlug;
  name: string;
}

function ShopView({ category, name }: ShopViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [page, setPage] = useState<CatalogPage | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);

  const query = searchParams.toString();
  const params = useMemo(
    () => parseShopParams(new URLSearchParams(query), category),
    [category, query]
  );

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");

    getCatalog(params)
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setShown(PAGE_SIZE);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  const write = useCallback(
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

      router.replace(`${pathname}${search ? `?${search}` : ""}` as never, {
        scroll: false,
      });
    },
    [pathname, query, router]
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(query);

    for (const key of ["brand", "build", "inStock", "max", "min", "spec"]) {
      next.delete(key);
    }

    const search = next.toString();

    router.replace(`${pathname}${search ? `?${search}` : ""}` as never, {
      scroll: false,
    });
  }, [pathname, query, router]);

  const onSort = useCallback(
    (sort: ProductSort) => write({ sort: sort === "newest" ? null : sort }),
    [write]
  );

  const openFilters = useCallback(() => setSheetOpen(true), []);
  const loadMore = useCallback(
    () => setShown((count) => count + PAGE_SIZE),
    []
  );

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (params.compatibleOnly) {
      filters.push({
        key: "build",
        label: "Compatible with my build",
        remove: () => write({ build: null }),
      });
    }

    if (params.inStockOnly) {
      filters.push({
        key: "inStock",
        label: "In stock only",
        remove: () => write({ inStock: null }),
      });
    }

    if (params.minRupees !== undefined || params.maxRupees !== undefined) {
      filters.push({
        key: "price",
        label: `₹${(params.minRupees ?? 0).toLocaleString("en-IN")} – ₹${(params.maxRupees ?? 0).toLocaleString("en-IN")}`,
        remove: () => write({ max: null, min: null }),
      });
    }

    for (const brand of params.brands ?? []) {
      filters.push({
        key: `brand-${brand}`,
        label: brand,
        remove: () =>
          write({
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
          write({
            spec:
              (params.specs ?? [])
                .filter((entry) => entry !== spec)
                .join(",") || null,
          }),
      });
    }

    return filters;
  }, [params, write]);

  const items = page?.items.slice(0, shown) ?? [];
  const hasMore = (page?.items.length ?? 0) > shown;

  return (
    <>
      <CategoryBand
        activeFilters={activeFilters}
        category={category}
        filterCount={countActiveFilters(params)}
        name={name}
        onOpenFilters={openFilters}
        onSort={onSort}
        sort={params.sort ?? "newest"}
        total={page?.total ?? 0}
      />

      <section className="mx-auto w-full max-w-[1280px] px-8 pb-24 lg:px-16">
        {status === "loading" ? (
          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {SKELETON_KEYS.map((key) => (
              <ComponentCardSkeleton key={key} />
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="mt-16">
            <p className="text-[15px] text-smoke">
              The catalogue did not load.
            </p>
            <Pill className="mt-5" onClick={openFilters} variant="ghost">
              Try again
            </Pill>
          </div>
        ) : null}

        {status === "ready" && items.length === 0 ? (
          <EmptyState filters={activeFilters} />
        ) : null}

        {status === "ready" && items.length > 0 ? (
          <>
            <Stagger
              className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3"
              key={query}
            >
              {items.map((product) => (
                <ComponentCard key={product.id} product={product} />
              ))}
            </Stagger>

            {hasMore ? (
              <div className="mt-14 flex justify-center">
                <Pill onClick={loadMore} variant="ghost">
                  Load more
                </Pill>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {page ? (
        <FilterSheet
          onChange={write}
          onClear={clearAll}
          onOpenChange={setSheetOpen}
          open={sheetOpen}
          page={page}
          params={params}
        />
      ) : null}
    </>
  );
}

/** One line, and up to three chips that each relax the nearest filter. */
function EmptyState({ filters }: { filters: ActiveFilter[] }) {
  return (
    <div className="mt-16">
      <Label>No matches</Label>
      <p className="mt-4 max-w-[46ch] text-[17px] text-bone">
        Nothing in this category matches every filter you have set.
      </p>

      {filters.length > 0 ? (
        <div className="mt-7 flex flex-wrap gap-3">
          {filters.slice(0, 3).map((filter) => (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-4 text-[13px] text-smoke transition-colors duration-[180ms] hover:border-smoke hover:text-bone"
              key={filter.key}
              onClick={filter.remove}
              type="button"
            >
              Drop “{filter.label}”
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { ShopView };
