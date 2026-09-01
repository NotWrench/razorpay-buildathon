import type { CatalogFilters, ProductSort } from "@/lib/queries/catalog";
import { PRODUCT_SORTS } from "@/lib/queries/catalog";

/**
 * The query string, turned into filters.
 *
 * One place, because the shelf page and any future rail that reads the same
 * parameters must agree about what `min=15000` means — rupees in the URL,
 * paise in the query. A shopper should be able to read their own address bar.
 */

export interface ParsedCatalogParams extends CatalogFilters {
  page: number;
  query?: string;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function rupeesToPaise(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const rupees = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);

  return Number.isFinite(rupees) ? rupees * 100 : undefined;
}

export function parseCatalogParams(
  raw: RawParams,
  pageSize: number
): ParsedCatalogParams {
  const sortValue = first(raw.sort);
  const sort = PRODUCT_SORTS.includes(sortValue as ProductSort)
    ? (sortValue as ProductSort)
    : undefined;

  const pageValue = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;

  const query = first(raw.q)?.trim() || undefined;

  return {
    category: first(raw.category),
    inStockOnly: first(raw.inStock) === "1",
    limit: pageSize,
    maxPricePaise: rupeesToPaise(first(raw.max)),
    minPricePaise: rupeesToPaise(first(raw.min)),
    offset: (page - 1) * pageSize,
    page,
    query,
    sort,
  };
}
