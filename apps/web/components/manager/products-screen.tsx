"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import type { ChangeEvent } from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/manager/manager-dialogs";
import { ManagerHeading } from "@/components/manager/manager-heading";
import {
  ManagerMenu,
  ManagerMenuGroup,
  ManagerMenuItem,
} from "@/components/manager/manager-menu";
import { ManagerSearch } from "@/components/manager/manager-search";
import { ProductCard } from "@/components/manager/product-card";
import type { ProductDraft } from "@/components/manager/product-sheet";
import { ProductSheet } from "@/components/manager/product-sheet";
import { useAction } from "@/hooks/use-action";
import {
  createPurchaseOrderAction,
  deactivateProductAction,
  duplicateProductAction,
  saveProductAction,
} from "@/lib/actions/manager";
import type { ManagerProduct } from "@/lib/data/types";

/**
 * The catalogue, as a grid of things you can change.
 *
 * No analysis here — which products sell and which are never seen is the
 * summary's job, and answering it twice in two voices is how an operator stops
 * believing either one. This screen knows names, prices, stock and status.
 *
 * It was a table of 44px thumbnails, which is the wrong shape for a shop that
 * sells things you look at — five columns of 13px text told you everything
 * except what the part is. The render is the card now.
 *
 * Filter and Sort used to be two pills that did nothing. They do something
 * now, and there is a search beside them, because a catalogue you cannot
 * narrow is a catalogue you scroll.
 *
 * `products` is the source of truth, not a copy in state: every write here
 * goes to the server and the page revalidates, so a card that changed is a
 * card the database agrees changed.
 */

type SortId = "name" | "price" | "stock" | "status";
type StatusFilter = "all" | "live" | "draft";

const SORTS: { id: SortId; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "price", label: "Price" },
  { id: "stock", label: "Stock" },
  { id: "status", label: "Status" },
];

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "live", label: "Live only" },
  { id: "draft", label: "Drafts only" },
];

const COMPARE: Record<
  SortId,
  (a: ManagerProduct, b: ManagerProduct) => number
> = {
  name: (a, b) => a.product.name.localeCompare(b.product.name),
  price: (a, b) => a.product.pricePaise - b.product.pricePaise,
  status: (a, b) => a.status.localeCompare(b.status),
  stock: (a, b) => a.stock - b.stock,
};

const ANY_CATEGORY = "__any__";

/** The suggested raise for a part: its threshold, doubled, floor of ten. */
const suggestedFor = (entry: ManagerProduct) => Math.max(10, entry.lowAt * 2);

function matches(entry: ManagerProduct, query: string) {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  return [entry.product.name, entry.product.brand, entry.product.category].some(
    (field) => field.toLowerCase().includes(needle)
  );
}

/** The quantity field inside the order dialog. */
function QuantityField({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  const id = useId();

  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(Math.max(1, Number(event.target.value) || 0)),
    [onChange]
  );

  return (
    <div>
      <Label htmlFor={id}>Units</Label>
      <input
        className="t-num-sm mt-2 h-[52px] w-full rounded-full border border-hairline bg-void px-5 text-bone outline-none transition-colors duration-micro focus:border-bone"
        id={id}
        inputMode="numeric"
        onChange={change}
        value={value}
      />
    </div>
  );
}

function ProductsScreen({ products }: { products: ManagerProduct[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ManagerProduct | null>(null);
  const [removing, setRemoving] = useState<ManagerProduct | null>(null);
  const [ordering, setOrdering] = useState<ManagerProduct | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState<SortId>("name");
  const [descending, setDescending] = useState(false);
  const [category, setCategory] = useState<string>(ANY_CATEGORY);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [lowOnly, setLowOnly] = useState(false);

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
  /*
   * The same action the restock screen's footer calls. Ordering a part is the
   * same act wherever you happen to be standing when you decide to, so it does
   * not get a second implementation here.
   */
  const reorder = useAction(createPurchaseOrderAction, {
    successMessage: "Raised on the restock list. Nothing has been ordered yet.",
  });

  const categories = useMemo(() => {
    const seen = new Set(
      products.map((entry) => entry.product.category as string)
    );

    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const shown = useMemo(() => {
    const filtered = products.filter(
      (entry) =>
        matches(entry, query) &&
        (category === ANY_CATEGORY || entry.product.category === category) &&
        (status === "all" || entry.status === status) &&
        (!lowOnly || entry.stock <= entry.lowAt)
    );
    const sorted = [...filtered].sort(COMPARE[sortId]);

    return descending ? sorted.reverse() : sorted;
  }, [category, descending, lowOnly, products, query, sortId, status]);

  const filtering =
    query.trim().length > 0 ||
    category !== ANY_CATEGORY ||
    status !== "all" ||
    lowOnly;

  const onSort = useCallback(
    (id: string) => {
      const next = id as SortId;

      setDescending((current) => (sortId === next ? !current : false));
      setSortId(next);
    },
    [sortId]
  );

  const onStatus = useCallback(
    (id: string) => setStatus(id as StatusFilter),
    []
  );

  const toggleLow = useCallback(() => setLowOnly((current) => !current), []);

  const onClearFilters = useCallback(() => {
    setQuery("");
    setCategory(ANY_CATEGORY);
    setStatus("all");
    setLowOnly(false);
  }, []);

  const onToggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

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

  const onOrderOpen = useCallback((entry: ManagerProduct) => {
    setQuantity(suggestedFor(entry));
    setOrdering(entry);
  }, []);

  const onOrderChange = useCallback(
    (open: boolean) => setOrdering(open ? ordering : null),
    [ordering]
  );

  const onOrderConfirm = useCallback(() => {
    if (ordering) {
      reorder.run([{ productId: ordering.product.id, quantity }]);
      setOrdering(null);
    }
  }, [ordering, quantity, reorder]);

  const onBulkOrder = useCallback(() => {
    const lines = products
      .filter((entry) => selected.includes(entry.product.id))
      .map((entry) => ({
        productId: entry.product.id,
        quantity: suggestedFor(entry),
      }));

    reorder.run(lines);
    setSelected([]);
  }, [products, reorder, selected]);

  const onRemoveOpen = useCallback(
    (open: boolean) => setRemoving(open ? removing : null),
    [removing]
  );

  const onRemoveConfirm = useCallback(() => {
    if (removing) {
      deactivate.run(removing.product.id);
    }
  }, [deactivate, removing]);

  const sortLabel = SORTS.find((entry) => entry.id === sortId)?.label ?? "Name";
  const busy = duplicate.pending || deactivate.pending || reorder.pending;

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={
          shown.length === products.length
            ? `${products.length} products`
            : `${shown.length} of ${products.length}`
        }
        title="Products"
      >
        <ManagerSearch
          className="w-full sm:w-[240px]"
          label="Search the catalogue"
          onValueChange={setQuery}
          placeholder="Name, brand, category"
          value={query}
        />

        <ManagerMenu label="Filter">
          <ManagerMenuGroup label="Category" />
          <ManagerMenuItem
            onSelect={setCategory}
            selected={category === ANY_CATEGORY}
            value={ANY_CATEGORY}
          >
            Any category
          </ManagerMenuItem>
          {categories.map((slug) => (
            <ManagerMenuItem
              key={slug}
              onSelect={setCategory}
              selected={category === slug}
              value={slug}
            >
              {slug}
            </ManagerMenuItem>
          ))}

          <ManagerMenuGroup label="Status" />
          {STATUSES.map((entry) => (
            <ManagerMenuItem
              key={entry.id}
              onSelect={onStatus}
              selected={status === entry.id}
              value={entry.id}
            >
              {entry.label}
            </ManagerMenuItem>
          ))}

          <ManagerMenuGroup label="Stock" />
          <ManagerMenuItem onSelect={toggleLow} selected={lowOnly} value="low">
            Low stock only
          </ManagerMenuItem>
        </ManagerMenu>

        <ManagerMenu
          label="Sort"
          value={`${sortLabel} ${descending ? "▼" : "▲"}`}
        >
          {SORTS.map((entry) => (
            <ManagerMenuItem
              key={entry.id}
              onSelect={onSort}
              selected={sortId === entry.id}
              value={entry.id}
            >
              {entry.label}
            </ManagerMenuItem>
          ))}
        </ManagerMenu>

        <Pill onClick={onAdd} size="sm">
          Add product
        </Pill>
      </ManagerHeading>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-5 py-14">
          <p className="t-body text-smoke">
            {filtering
              ? "Nothing matches those filters."
              : "Nothing in the catalogue."}
          </p>
          {filtering ? (
            <Pill onClick={onClearFilters} size="sm" variant="text">
              Clear filters
            </Pill>
          ) : (
            <Pill onClick={onAdd} size="sm" variant="ghost">
              Add the first product
            </Pill>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((entry) => (
            <ProductCard
              busy={busy}
              entry={entry}
              key={entry.product.id}
              onDuplicate={onDuplicate}
              onEdit={onEdit}
              onOrder={onOrderOpen}
              onRemove={setRemoving}
              onToggle={onToggle}
              selected={selected.includes(entry.product.id)}
              selecting={selected.length > 0}
            />
          ))}
        </ul>
      )}

      {/* Mirrors restock's footer: one line of arithmetic, one filled pill. */}
      {selected.length > 0 ? (
        <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-5 border-hairline border-t bg-void py-5">
          <span className="t-num-xs text-smoke">
            {selected.length} selected
          </span>
          <div className="flex items-center gap-4">
            <Pill onClick={clearSelection} size="sm" variant="text">
              Clear
            </Pill>
            <Pill disabled={reorder.pending} onClick={onBulkOrder} size="sm">
              Add to restock
            </Pill>
          </div>
        </div>
      ) : null}

      <ProductSheet
        busy={save.pending}
        entry={editing}
        onOpenChange={setSheetOpen}
        onSave={onSave}
        open={sheetOpen}
      />

      <ConfirmDialog
        body={`How many units of ${ordering?.product.name ?? "this product"} should join the restock list?${ordering ? ` ${ordering.stock} on hand today.` : ""}`}
        confirmLabel="Add to restock"
        onConfirm={onOrderConfirm}
        onOpenChange={onOrderChange}
        open={ordering !== null}
        title="Order more"
        tone="constructive"
      >
        <QuantityField onChange={setQuantity} value={quantity} />
        {ordering ? (
          <p className="t-num-xs mt-3 text-smoke">
            estimated {formatPaise(quantity * ordering.product.pricePaise)}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        body={`${removing?.product.name ?? "This product"} will be taken off sale. Nothing is deleted — past orders still point at it.`}
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
