"use client";

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { XIcon } from "lucide-react";
import { useProductFilters } from "@/hooks/use-product-filters";

/**
 * Sort, price and availability.
 *
 * Prices are typed in rupees and stored in the URL in rupees, then converted
 * to paise once on the server. Paise in a query string would be a number no
 * shopper could read back.
 */

const SORT_LABELS = [
  { label: "In stock, cheapest first", value: "relevance" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Newest", value: "newest" },
] as const;

export function ProductToolbar({ total }: { total: number }) {
  const { clear, get, pending, set } = useProductFilters();

  const hasFilters = Boolean(
    get("category") || get("q") || get("min") || get("max") || get("inStock")
  );

  return (
    <div className="flex flex-wrap items-end gap-3 border-border border-b pb-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs" htmlFor="sort">
          Sort
        </Label>
        <Select
          items={SORT_LABELS}
          onValueChange={(value) => set({ sort: String(value) })}
          value={get("sort") ?? "relevance"}
        >
          <SelectTrigger className="w-56" id="sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_LABELS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs" htmlFor="min">
          Min ₹
        </Label>
        <Input
          className="w-24"
          defaultValue={get("min") ?? ""}
          id="min"
          inputMode="numeric"
          onBlur={(event) => set({ min: event.target.value || null })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs" htmlFor="max">
          Max ₹
        </Label>
        <Input
          className="w-24"
          defaultValue={get("max") ?? ""}
          id="max"
          inputMode="numeric"
          onBlur={(event) => set({ max: event.target.value || null })}
        />
      </div>

      <Label as="label" className="flex items-center gap-2 pb-2 text-sm">
        <Checkbox
          checked={get("inStock") === "1"}
          onCheckedChange={(checked) => set({ inStock: checked ? "1" : null })}
        />
        In stock only
      </Label>

      <div className="ml-auto flex items-center gap-2 pb-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {pending ? "Filtering…" : `${total} part(s)`}
        </span>
        {hasFilters ? (
          <Button onClick={clear} size="xs" variant="ghost">
            <XIcon />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
