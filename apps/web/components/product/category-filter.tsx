"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useProductFilters } from "@/hooks/use-product-filters";
import type { CategoryFacet } from "@/lib/queries/catalog";

/** The component taxonomy as a filter rail, with counts. */
export function CategoryFilter({
  categories,
}: {
  categories: CategoryFacet[];
}) {
  const { get, set } = useProductFilters();
  const active = get("category");

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        className={cn(!active && "bg-muted text-foreground")}
        onClick={() => set({ category: null })}
        size="xs"
        variant="ghost"
      >
        All
      </Button>

      {categories
        .filter((category) => category.productCount > 0)
        .map((category) => (
          <Button
            className={cn(
              active === category.slug && "bg-muted text-foreground"
            )}
            key={category.id}
            onClick={() => set({ category: category.slug })}
            size="xs"
            variant="ghost"
          >
            {category.name}
            <span className="ml-1 text-muted-foreground tabular-nums">
              {category.productCount}
            </span>
          </Button>
        ))}
    </div>
  );
}
