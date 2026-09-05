"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { type ReactElement, useMemo, useState } from "react";
import { Money } from "@/components/common/money";
import { StockBadge } from "@/components/product/stock-badge";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { headlineSpecs } from "@/lib/specs";

/**
 * Choosing a part for a slot.
 *
 * The list is filtered in the browser because a slot's candidates are one
 * category of a store's catalog — small enough that a round trip per keystroke
 * would be slower than the typing. Nothing here judges compatibility: the
 * engine does that after the part is in, so the buyer can try a combination
 * and be told why it does not work rather than being quietly prevented.
 */
export function PartPicker({
  categoryName,
  disabled,
  onPick,
  products,
  trigger,
}: {
  categoryName: string;
  disabled?: boolean;
  onPick: (productId: string) => void;
  products: CatalogProduct[];
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return products;
    }

    return products.filter((product) =>
      `${product.name} ${product.brand ?? ""}`.toLowerCase().includes(needle)
    );
  }, [products, query]);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger disabled={disabled} render={trigger} />
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a {categoryName.toLowerCase()} part</DialogTitle>
          <DialogDescription>
            Everything this store stocks in this category. Compatibility is
            checked once it is in the build.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or brand…"
          value={query}
        />

        <ul className="-mx-2 max-h-[50vh] space-y-1 overflow-y-auto px-2">
          {matches.map((product) => (
            <li key={product.id}>
              <button
                className="flex w-full items-start justify-between gap-3 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/50"
                onClick={() => {
                  onPick(product.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-sm">
                    {product.name}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground text-xs">
                    {headlineSpecs(product.category, product.specs).join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <Money paise={product.price} size="sm" />
                  <StockBadge className="block" stock={product.stock} />
                </span>
              </button>
            </li>
          ))}

          {matches.length === 0 ? (
            <li className="p-4 text-center text-muted-foreground text-sm">
              Nothing in this category matches that.
            </li>
          ) : null}
        </ul>

        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)} size="sm" variant="outline">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
