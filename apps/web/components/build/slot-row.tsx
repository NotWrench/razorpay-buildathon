"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/common/money";
import type { CatalogProduct } from "@/lib/queries/catalog";
import type { BuildSlotEntry } from "@/lib/queries/builds";
import { headlineSpecs } from "@/lib/specs";
import { PartPicker } from "./part-picker";

/**
 * One slot in the build.
 *
 * A slot is drawn even when it is empty, and a required empty slot says so —
 * `build_completeness` will report it anyway, and a row that only appears once
 * filled leaves the buyer guessing at what a computer needs.
 */
export function SlotRow({
  affected,
  candidates,
  categoryName,
  entries,
  onPick,
  onRemove,
  pending,
  required,
  slug,
}: {
  affected: Set<string>;
  candidates: CatalogProduct[];
  categoryName: string;
  entries: BuildSlotEntry[];
  onPick: (productId: string) => void;
  onRemove: (productId: string) => void;
  pending: boolean;
  required: boolean;
  slug: string;
}) {
  const empty = entries.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-border border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center",
        empty && required && "bg-muted/30"
      )}
    >
      <div className="w-full shrink-0 sm:w-36">
        <p className="font-medium text-sm">{categoryName}</p>
        <p className="text-muted-foreground text-xs">
          {required ? "Required" : "Optional"}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {empty ? (
          <p className="text-muted-foreground text-sm">
            Nothing selected{required ? " yet — a build needs one." : "."}
          </p>
        ) : (
          entries.map((entry) => (
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border p-2",
                affected.has(entry.product.id)
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-border/60"
              )}
              key={entry.product.id}
            >
              <div className="min-w-0">
                <Link
                  className="font-medium text-sm hover:underline"
                  href={`/store/${slug}/products/${entry.product.id}`}
                >
                  {entry.product.name}
                </Link>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {headlineSpecs(entry.product.category, entry.specs).join(
                    " · "
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Money paise={entry.product.price * entry.quantity} size="sm" />
                <Button
                  aria-label={`Remove ${entry.product.name}`}
                  disabled={pending}
                  onClick={() => onRemove(entry.product.id)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <PartPicker
        categoryName={categoryName}
        disabled={pending || candidates.length === 0}
        onPick={onPick}
        products={candidates}
        trigger={
          <Button
            className="shrink-0"
            size="xs"
            variant={empty && required ? "default" : "outline"}
          >
            <PlusIcon />
            {empty ? "Choose" : "Add or swap"}
          </Button>
        }
      />
    </div>
  );
}
