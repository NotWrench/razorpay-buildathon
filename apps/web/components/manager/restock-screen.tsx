"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductRender } from "@/components/common/product-render";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable, RowAction } from "@/components/manager/manager-table";
import { RestockPicker } from "@/components/manager/restock-picker";
import { SelectCell } from "@/components/manager/select-cell";
import type {
  ManagerProduct,
  RestockDraft,
  RestockRow,
} from "@/lib/data/types";

/**
 * What is running out, and what to do about it.
 *
 * The rows are real: whatever the store holds below its reorder point, plus
 * whatever the assistant drafted about it. What was missing is the other
 * direction — an operator who knows a part is about to move could not put it
 * on the order, because the only way onto this list was to already be running
 * out. `Add product` is that way in, and rows added by hand can be taken off
 * again.
 *
 * The editable cells are real inputs, not spans that turn into inputs on
 * click: a number an operator is expected to change should be focusable with
 * Tab and typed into without a ceremony first.
 *
 * Drafts the assistant made on /manager arrive at the top with the reason it
 * made them. Approve and Reject are both ghost — approving somebody else's
 * suggestion is a decision, and a filled pill would be the page taking a side.
 *
 * Nothing here writes: approving, rejecting and creating the order all move
 * local state and say so in the toast.
 */

const rowKey = (row: RestockRow) => row.id;

function NumberCell({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (id: string, value: number) => void;
  value: number;
}) {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(id, Math.max(0, Number(event.target.value) || 0)),
    [id, onChange]
  );

  return (
    <input
      aria-label={label}
      className="t-num-sm h-9 w-24 rounded-full border border-hairline bg-transparent px-3 text-right text-bone outline-none transition-colors duration-micro focus:border-bone"
      inputMode="numeric"
      onChange={change}
      value={value}
    />
  );
}

function DraftCard({
  draft,
  onApprove,
  onReject,
}: {
  draft: RestockDraft;
  onApprove: (draft: RestockDraft) => void;
  onReject: (draft: RestockDraft) => void;
}) {
  const approve = useCallback(() => onApprove(draft), [draft, onApprove]);
  const reject = useCallback(() => onReject(draft), [draft, onReject]);

  return (
    <div className="flex flex-col rounded-[20px] border border-hairline bg-panel p-5">
      <div className="flex items-center gap-4">
        <ImageGround className="size-11 shrink-0 rounded-[10px] p-1.5">
          <ProductRender
            alt=""
            category={draft.product.category}
            sizes="44px"
            src={draft.product.imageUrl || undefined}
          />
        </ImageGround>

        <p className="t-body min-w-0 flex-1 truncate text-bone">
          {draft.product.name}
        </p>

        <span className="t-num-sm shrink-0 text-bone">
          {draft.quantity} units
        </span>
      </div>

      <p className="t-body-sm mt-4 text-smoke">{draft.provenance}</p>

      <div className="mt-5 flex gap-3">
        <Pill onClick={approve} size="sm" variant="ghost">
          Approve
        </Pill>
        <Pill onClick={reject} size="sm" variant="ghost">
          Reject
        </Pill>
      </div>
    </div>
  );
}

/** Only rows an operator put here by hand can be taken off again. */
function DropAction({
  onDrop,
  row,
}: {
  onDrop: (row: RestockRow) => void;
  row: RestockRow;
}) {
  const drop = useCallback(() => onDrop(row), [onDrop, row]);

  return (
    <RowAction
      label={`Take ${row.product.name} off the order`}
      onClick={drop}
      tone="lacquer"
    >
      <Trash2 aria-hidden className="size-3.5" />
    </RowAction>
  );
}

function RestockScreen({
  catalogue,
  drafts: initialDrafts,
  rows: initialRows,
}: {
  /** The whole catalogue, so a part can be added by hand. */
  catalogue: ManagerProduct[];
  drafts: RestockDraft[];
  rows: RestockRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const openPicker = useCallback(() => setPicking(true), []);

  const onToggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }, []);

  const onThreshold = useCallback((id: string, value: number) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, threshold: value } : row))
    );
  }, []);

  const onSuggested = useCallback((id: string, value: number) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, suggested: value } : row))
    );
  }, []);

  /* The picker only offers what is not already on the order. */
  const available = useMemo(() => {
    const listed = new Set(rows.map((row) => row.product.id));

    return catalogue.filter((entry) => !listed.has(entry.product.id));
  }, [catalogue, rows]);

  const onAdd = useCallback((entry: ManagerProduct, quantity: number) => {
    const row: RestockRow = {
      id: `manual-${entry.product.id}`,
      inStock: entry.stock,
      product: entry.product,
      suggested: quantity,
      threshold: entry.lowAt,
    };

    setRows((current) => [row, ...current]);
    setManual((current) => [...current, row.id]);
    /* Added by hand means wanted on the order, so it arrives ticked. */
    setSelected((current) => [...current, row.id]);
    toast(`${entry.product.name} added to the order.`);
  }, []);

  const onDrop = useCallback((row: RestockRow) => {
    setRows((current) => current.filter((entry) => entry.id !== row.id));
    setManual((current) => current.filter((entry) => entry !== row.id));
    setSelected((current) => current.filter((entry) => entry !== row.id));
  }, []);

  const onApprove = useCallback((draft: RestockDraft) => {
    setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    toast(`Approved. ${draft.quantity} units of ${draft.product.name} queued.`);
  }, []);

  const onReject = useCallback((draft: RestockDraft) => {
    setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    toast("Rejected. The assistant will not raise it again this window.");
  }, []);

  const chosen = useMemo(
    () => rows.filter((row) => selected.includes(row.id)),
    [rows, selected]
  );

  const estimate = useMemo(
    () =>
      chosen.reduce(
        (total, row) => total + row.suggested * row.product.pricePaise,
        0
      ),
    [chosen]
  );

  const units = useMemo(
    () => chosen.reduce((total, row) => total + row.suggested, 0),
    [chosen]
  );

  const clearSelection = useCallback(() => setSelected([]), []);

  const onCreate = useCallback(() => {
    toast(
      `Purchase order drafted for ${chosen.length} lines — ${formatPaise(estimate)}. Nothing has been sent.`
    );
  }, [chosen.length, estimate]);

  const columns = useMemo<ManagerColumn<RestockRow>[]>(
    () => [
      {
        id: "select",
        label: "",
        render: (row) => (
          <SelectCell
            checked={selected.includes(row.id)}
            id={row.id}
            label={`Include ${row.product.name}`}
            onToggle={onToggle}
          />
        ),
        width: "48px",
      },
      {
        id: "product",
        label: "Product",
        render: (row) => (
          <div className="flex min-w-0 items-center gap-4">
            <ImageGround className="size-10 shrink-0 rounded-[10px] p-1.5">
              <ProductRender
                alt=""
                category={row.product.category}
                sizes="40px"
                src={row.product.imageUrl || undefined}
              />
            </ImageGround>
            <div className="min-w-0">
              <p className="t-body truncate text-bone">{row.product.name}</p>
              {manual.includes(row.id) ? (
                <Label className="mt-0.5 block">Added by hand</Label>
              ) : null}
            </div>
          </div>
        ),
        sort: (a, b) => a.product.name.localeCompare(b.product.name),
        width: "auto",
      },
      {
        align: "right",
        id: "inStock",
        label: "In stock",
        render: (row) => (
          /* Amber means "this is the problem". A part somebody added by hand
             while it is still comfortably stocked is not one. */
          <span
            className={cn(
              "t-num-sm",
              row.inStock <= row.threshold ? "text-amber" : "text-smoke"
            )}
          >
            {row.inStock}
          </span>
        ),
        sort: (a, b) => a.inStock - b.inStock,
        width: "7rem",
      },
      {
        align: "right",
        id: "threshold",
        label: "Threshold",
        render: (row) => (
          <NumberCell
            id={row.id}
            label={`Threshold for ${row.product.name}`}
            onChange={onThreshold}
            value={row.threshold}
          />
        ),
        width: "9rem",
      },
      {
        align: "right",
        id: "suggested",
        label: "Order qty",
        render: (row) => (
          <NumberCell
            id={row.id}
            label={`Order quantity for ${row.product.name}`}
            onChange={onSuggested}
            value={row.suggested}
          />
        ),
        width: "9rem",
      },
      {
        align: "right",
        id: "lineTotal",
        label: "Line total",
        render: (row) => (
          <span
            className={cn(
              "t-num-sm",
              selected.includes(row.id) ? "text-bone" : "text-smoke"
            )}
          >
            {formatPaise(row.suggested * row.product.pricePaise)}
          </span>
        ),
        sort: (a, b) =>
          a.suggested * a.product.pricePaise -
          b.suggested * b.product.pricePaise,
        width: "10rem",
      },
    ],
    [manual, onSuggested, onThreshold, onToggle, selected]
  );

  const actions = useCallback(
    (row: RestockRow) =>
      manual.includes(row.id) ? <DropAction onDrop={onDrop} row={row} /> : null,
    [manual, onDrop]
  );

  return (
    <div className="px-5 pt-14 pb-32 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading count={`${rows.length} on this order`} title="Restock">
        <Pill onClick={openPicker} size="sm" variant="ghost">
          Add product
        </Pill>
      </ManagerHeading>

      {drafts.length > 0 ? (
        <section className="pb-12">
          <Label>From the assistant</Label>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft) => (
              <DraftCard
                draft={draft}
                key={draft.id}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ManagerTable
        actions={actions}
        columns={columns}
        empty={
          <div className="flex flex-col items-start gap-5">
            <p className="t-body text-smoke">Nothing is below its threshold.</p>
            {/* Healthy stock is not a dead end: you can still order ahead. */}
            <Pill onClick={openPicker} size="sm" variant="ghost">
              Add a product anyway
            </Pill>
          </div>
        }
        rowKey={rowKey}
        rows={rows}
      />

      {/* The footer is the only place on this screen with a filled pill: one
          constructive action, at the end of the work. */}
      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-5 border-hairline border-t bg-void py-5">
        <span className="t-num-xs text-smoke">
          {chosen.length} lines · {units} units · estimated{" "}
          {formatPaise(estimate)}
        </span>
        <div className="flex items-center gap-4">
          {chosen.length > 0 ? (
            <Pill onClick={clearSelection} size="sm" variant="text">
              Clear
            </Pill>
          ) : null}
          <Pill disabled={chosen.length === 0} onClick={onCreate} size="sm">
            Create purchase order
          </Pill>
        </div>
      </div>

      <RestockPicker
        catalogue={available}
        onAdd={onAdd}
        onOpenChange={setPicking}
        open={picking}
      />
    </div>
  );
}

export { RestockScreen };
