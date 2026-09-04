"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Copy, EyeOff, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ProductRender } from "@/components/common/product-render";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable, RowAction } from "@/components/manager/manager-table";
import type { ProductDraft } from "@/components/manager/product-sheet";
import { ProductSheet } from "@/components/manager/product-sheet";
import { useAction } from "@/hooks/use-action";
import {
  deactivateProductAction,
  duplicateProductAction,
  saveProductAction,
} from "@/lib/actions/manager";
import type { ManagerProduct } from "@/lib/data/types";

/**
 * The catalogue, as a list of things you can change.
 *
 * No analysis here — which products sell and which are never seen is the
 * summary's job, and answering it twice in two voices is how an operator stops
 * believing either one. This screen knows names, prices, stock and status.
 */

function ProductActions({
  entry,
  onDuplicate,
  onEdit,
  onRemove,
}: {
  entry: ManagerProduct;
  onDuplicate: (entry: ManagerProduct) => void;
  onEdit: (entry: ManagerProduct) => void;
  onRemove: (entry: ManagerProduct) => void;
}) {
  const edit = useCallback(() => onEdit(entry), [entry, onEdit]);
  const duplicate = useCallback(() => onDuplicate(entry), [entry, onDuplicate]);
  const remove = useCallback(() => onRemove(entry), [entry, onRemove]);

  return (
    <>
      <RowAction label={`Edit ${entry.product.name}`} onClick={edit}>
        <Pencil aria-hidden className="size-3.5" />
      </RowAction>
      <RowAction label={`Duplicate ${entry.product.name}`} onClick={duplicate}>
        <Copy aria-hidden className="size-3.5" />
      </RowAction>
      <RowAction
        label={`Take ${entry.product.name} off sale`}
        onClick={remove}
        tone="lacquer"
      >
        {/* Not a bin. Nothing here deletes — the row survives, off sale,
            because order_items still points at it. */}
        <EyeOff aria-hidden className="size-3.5" />
      </RowAction>
    </>
  );
}

const productKey = (entry: ManagerProduct) => entry.product.id;

function ProductsScreen({ products: rows }: { products: ManagerProduct[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ManagerProduct | null>(null);
  const [removing, setRemoving] = useState<ManagerProduct | null>(null);

  const save = useAction(saveProductAction, {
    onSuccess: () => setSheetOpen(false),
    successMessage: "Saved.",
  });
  const duplicate = useAction(duplicateProductAction, {
    successMessage: "Duplicated as a draft. It is not on sale.",
  });
  const deactivate = useAction(deactivateProductAction, {
    onSuccess: () => setRemoving(null),
    successMessage: "Taken off sale. Past orders are unaffected.",
  });

  const onAdd = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const onEdit = useCallback((entry: ManagerProduct) => {
    setEditing(entry);
    setSheetOpen(true);
  }, []);

  const onSave = useCallback(
    (draft: ProductDraft) =>
      save.run({ ...draft, productId: editing?.product.id }),
    [editing, save]
  );

  const onDuplicate = useCallback(
    (entry: ManagerProduct) => duplicate.run(entry.product.id),
    [duplicate]
  );

  const onRemoveConfirm = useCallback(() => {
    if (removing) {
      deactivate.run(removing.product.id);
    }
  }, [deactivate, removing]);

  const onRemoveOpen = useCallback(
    (open: boolean) => setRemoving(open ? removing : null),
    [removing]
  );

  const columns = useMemo<ManagerColumn<ManagerProduct>[]>(
    () => [
      {
        id: "image",
        label: "Image",
        render: (entry) => (
          <ImageGround className="size-11 rounded-[10px] p-1.5">
            <ProductRender alt="" category={entry.product.category} />
          </ImageGround>
        ),
        width: "64px",
      },
      {
        id: "name",
        label: "Name",
        render: (entry) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] text-bone">
              {entry.product.name}
            </p>
            <Label className="mt-0.5 block">{entry.product.category}</Label>
          </div>
        ),
        sort: (a, b) => a.product.name.localeCompare(b.product.name),
        width: "auto",
      },
      {
        align: "right",
        id: "price",
        label: "Price",
        render: (entry) => (
          /* The hovered row outlines this cell: the price is the thing an
             operator changes most, and the outline says so without adding a
             pencil to every row. */
          <span className="inline-flex h-8 items-center rounded-full border border-transparent px-3 font-mono text-[15px] text-bone tabular-nums transition-colors duration-[180ms] group-hover:border-hairline">
            {formatPaise(entry.product.pricePaise)}
          </span>
        ),
        sort: (a, b) => a.product.pricePaise - b.product.pricePaise,
        width: "9rem",
      },
      {
        align: "right",
        id: "stock",
        label: "Stock",
        render: (entry) => (
          <span
            className={cn(
              "font-mono text-[15px] tabular-nums",
              entry.stock <= entry.lowAt ? "text-amber" : "text-bone"
            )}
          >
            {entry.stock}
          </span>
        ),
        sort: (a, b) => a.stock - b.stock,
        width: "6rem",
      },
      {
        id: "status",
        label: "Status",
        render: (entry) => (
          <span className="text-[13px] text-smoke">
            {entry.status === "live" ? "Live" : "Draft"}
          </span>
        ),
        sort: (a, b) => a.status.localeCompare(b.status),
        width: "6rem",
      },
    ],
    []
  );

  const actions = useCallback(
    (entry: ManagerProduct) => (
      <ProductActions
        entry={entry}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onRemove={setRemoving}
      />
    ),
    [onDuplicate, onEdit]
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading count={`${rows.length} products`} title="Products">
        <Pill size="sm" variant="ghost">
          Filter
        </Pill>
        <Pill size="sm" variant="text">
          Sort: name
        </Pill>
        <Pill onClick={onAdd} size="sm">
          Add product
        </Pill>
      </ManagerHeading>

      <ManagerTable
        actions={actions}
        columns={columns}
        empty={
          <div className="flex flex-col items-start gap-5">
            <p className="text-[16px] text-smoke">Nothing in the catalogue.</p>
            <Pill onClick={onAdd} size="sm" variant="ghost">
              Add the first product
            </Pill>
          </div>
        }
        rowKey={productKey}
        rows={rows}
      />

      <ProductSheet
        busy={save.pending}
        entry={editing}
        onOpenChange={setSheetOpen}
        onSave={onSave}
        open={sheetOpen}
      />

      <ConfirmDialog
        body={`${removing?.product.name ?? "This product"} will be taken off sale. It is not deleted, and orders that already contain it still name it.`}
        confirmLabel="Take off sale"
        onConfirm={onRemoveConfirm}
        onOpenChange={onRemoveOpen}
        open={removing !== null}
        title="Take this product off sale"
      />
    </div>
  );
}

export { ProductsScreen };
