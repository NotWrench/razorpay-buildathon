import type { CategorySlug } from "@workspace/db/taxonomy";
import type { CatalogQuery, ProductSort } from "@/lib/data/types";
import { PRODUCT_SORTS } from "@/lib/data/types";

/**
 * The shop's query string.
 *
 * Same convention as `lib/catalog-params.ts`, which parses the v1 shelf:
 * **rupees in the URL, paise everywhere behind it**. A shopper should be able
 * to read their own address bar, and `min=15000` should mean fifteen thousand
 * rupees rather than a hundred and fifty.
 */

export interface ShopParams extends CatalogQuery {
  category?: CategorySlug;
}

function number(value: string | null): number | undefined {
  if (!value) {
    return;
  }

  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function list(value: string | null): string[] | undefined {
  const entries = value?.split(",").filter(Boolean);

  return entries?.length ? entries : undefined;
}

export function parseShopParams(
  params: URLSearchParams,
  category?: CategorySlug
): ShopParams {
  const sort = params.get("sort");

  return {
    brands: list(params.get("brand")),
    category,
    compatibleOnly: params.get("build") === "1",
    inStockOnly: params.get("inStock") === "1",
    maxRupees: number(params.get("max")),
    minRupees: number(params.get("min")),
    query: params.get("q") ?? undefined,
    sort: PRODUCT_SORTS.includes(sort as ProductSort)
      ? (sort as ProductSort)
      : undefined,
    specs: list(params.get("spec")),
  };
}

/** How many filters the shopper has actually set. Sort is not a filter. */
export function countActiveFilters(params: ShopParams): number {
  return [
    params.brands?.length,
    params.compatibleOnly,
    params.inStockOnly,
    params.maxRupees !== undefined,
    params.minRupees !== undefined,
    params.specs?.length,
  ].filter(Boolean).length;
}

/** Writes one change into a query string, dropping anything emptied. */
export function withParam(
  params: URLSearchParams,
  key: string,
  value: string | null
): string {
  const next = new URLSearchParams(params);

  if (value === null || value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }

  const query = next.toString();

  return query ? `?${query}` : "";
}

/**
 * The page's `searchParams` prop, back into a query string.
 *
 * The server reads params as an object and the client writes them as a
 * string; this is the one place the two shapes meet, so they cannot drift.
 */
export function toQueryString(
  raw: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }

  return params.toString();
}
