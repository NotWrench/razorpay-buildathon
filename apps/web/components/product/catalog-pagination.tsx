"use client";

import { Button } from "@workspace/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useProductFilters } from "@/hooks/use-product-filters";

/** Page through the shelf, keeping every other filter as it was. */
export function CatalogPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const { set } = useProductFilters();

  const pages = Math.max(Math.ceil(total / pageSize), 1);

  if (pages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 pt-2"
    >
      <Button
        disabled={page <= 1}
        onClick={() => set({ page: String(page - 1) })}
        size="sm"
        variant="outline"
      >
        <ChevronLeftIcon />
        Previous
      </Button>

      <span className="text-muted-foreground text-xs tabular-nums">
        Page {page} of {pages}
      </span>

      <Button
        disabled={page >= pages}
        onClick={() => set({ page: String(page + 1) })}
        size="sm"
        variant="outline"
      >
        Next
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}
