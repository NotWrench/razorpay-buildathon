"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductRender } from "@/components/common/product-render";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable } from "@/components/manager/manager-table";
import { useAction } from "@/hooks/use-action";
import {
  approveRestockAction,
  createPurchaseOrderAction,
  rejectRestockAction,
  saveThresholdsAction,
} from "@/lib/actions/manager";
import type { RestockDraft, RestockRow } from "@/lib/data/types";

/**
 * What is running out, and what to do about it.
 *
 * The editable cells are real inputs, not spans that turn into inputs on
 * click: a number an operator is expected to change should be focusable with
 * Tab and typed into without a ceremony first. They commit on blur and on
 * Enter rather than on every keystroke — one write per decision, not one per
 * digit, and an audit trail that reads as decisions rather than typing.
 *
 * Drafts the assistant made on /manager arrive at the top with the reason it
 * made them. Approve and Reject are both ghost — approving somebody else's
 * suggestion is a decision, and a filled pill would be the page taking a side.
 *
 * Nothing here holds its own copy of the data. Every action revalidates on the
 * server and the screen re-renders from it, so what is on screen is what is in
 * the database rather than an optimistic guess that survives a failed write.
 */

const rowKey = (row: RestockRow) => row.id;

function NumberCell({
  id,
  label,
  onCommit,
  value,
}: {
  id: string;
  label: string;
  onCommit: (id: string, value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));

  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    []
  );

  const commit = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const next = Math.max(0, Number(event.target.value) || 0);

      setDraft(String(next));

      if (next !== value) {
        onCommit(id, next);
      }
    },
    [id, onCommit, value]
  );

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }, []);

  return (
    <input
      aria-label={label}
      className="t-num-sm h-8 w-20 rounded-full border border-hairline bg-transparent px-3 text-right text-bone outline-none transition-colors duration-micro focus:border-bone"
      inputMode="numeric"
      onBlur={commit}
      onChange={change}
      onKeyDown={onKeyDown}
      value={draft}
    />
  );
}

function SelectCell({
  checked,
  id,
  label,
  onToggle,
}: {
  checked: boolean;
  id: string;
  label: string;
  onToggle: (id: string) => void;
}) {
  const change = useCallback(() => onToggle(id), [id, onToggle]);
  const inputId = `restock-${id}`;

  return (
    <>
      <input
        checked={checked}
        className="peer sr-only"
        id={inputId}
        onChange={change}
        type="checkbox"
      />
      <label
        className={cn(
          "flex size-5 cursor-pointer items-center justify-center rounded-[6px] border transition-colors duration-micro",
          checked ? "border-bone" : "border-hairline hover:border-smoke",
          "peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-bone peer-focus-visible:outline-offset-[3px]"
        )}
        htmlFor={inputId}
      >
        <span className="sr-only">{label}</span>
        {checked ? (
          <Check
            aria-hidden
            className="check-in size-3.5 text-bone"
            strokeWidth={2.5}
          />
        ) : null}
      </label>
    </>
  );
}

function DraftRow({
  busy,
  draft,
  onApprove,
  onReject,
}: {
  busy: boolean;
  draft: RestockDraft;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const approve = useCallback(() => onApprove(draft.id), [draft.id, onApprove]);
  const reject = useCallback(() => onReject(draft.id), [draft.id, onReject]);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-hairline border-b py-5">
      <ImageGround className="size-11 shrink-0 rounded-[10px] p-1.5">
        <ProductRender alt="" category={draft.product.category} />
      </ImageGround>

      <div className="min-w-0 flex-1">
        <p className="t-body truncate text-bone">
          {draft.product.name} ·{" "}
          <span className="font-mono tabular-nums">{draft.quantity}</span> units
        </p>
        <p className="t-body-sm mt-1 text-smoke">{draft.provenance}</p>
      </div>

      <div className="flex shrink-0 gap-3">
        <Pill disabled={busy} onClick={approve} size="sm" variant="ghost">
          Approve
        </Pill>
        <Pill disabled={busy} onClick={reject} size="sm" variant="ghost">
          Reject
        </Pill>
      </div>
    </div>
  );
}

function RestockScreen({
  drafts,
  rows,
}: {
  drafts: RestockDraft[];
  rows: RestockRow[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const approve = useAction(approveRestockAction, {
    successMessage: "Approved. Recorded against the request.",
  });
  const reject = useAction(rejectRestockAction, {
    successMessage: "Rejected, with the decision recorded.",
  });
  const thresholds = useAction(saveThresholdsAction, {
    successMessage: "Thresholds saved.",
  });
  const purchase = useAction(createPurchaseOrderAction, {
    onSuccess: ({ created }) => {
      setSelected([]);
      toast.success(
        `${created} request(s) raised and waiting on you. Nothing has been ordered.`
      );
    },
  });

  const onToggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    );
  }, []);

  const byId = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows]
  );

  const onThreshold = useCallback(
    (id: string, value: number) => {
      const row = byId.get(id);

      if (row) {
        thresholds.run({
          productId: id,
          reorderQuantity: row.suggested,
          threshold: value,
        });
      }
    },
    [byId, thresholds]
  );

  const onSuggested = useCallback(
    (id: string, value: number) => {
      const row = byId.get(id);

      if (row) {
        thresholds.run({
          productId: id,
          reorderQuantity: value,
          threshold: row.threshold,
        });
      }
    },
    [byId, thresholds]
  );

  const estimate = useMemo(
    () =>
      rows
        .filter((row) => selected.includes(row.id))
        .reduce(
          (total, row) => total + row.suggested * row.product.pricePaise,
          0
        ),
    [rows, selected]
  );

  const onCreate = useCallback(() => {
    purchase.run(
      rows
        .filter((row) => selected.includes(row.id))
        .map((row) => ({ productId: row.id, quantity: row.suggested }))
    );
  }, [purchase, rows, selected]);

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
              <ProductRender alt="" category={row.product.category} />
            </ImageGround>
            <p className="t-body truncate text-bone">{row.product.name}</p>
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
          <span className="t-num-sm text-amber">
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
            key={`threshold-${row.id}-${row.threshold}`}
            label={`Threshold for ${row.product.name}`}
            onCommit={onThreshold}
            value={row.threshold}
          />
        ),
        width: "8rem",
      },
      {
        align: "right",
        id: "suggested",
        label: "Suggested qty",
        render: (row) => (
          <NumberCell
            id={row.id}
            key={`suggested-${row.id}-${row.suggested}`}
            label={`Suggested quantity for ${row.product.name}`}
            onCommit={onSuggested}
            value={row.suggested}
          />
        ),
        width: "9rem",
      },
    ],
    [onSuggested, onThreshold, onToggle, selected]
  );

  const busy = approve.pending || reject.pending;

  return (
    <div className="px-5 pt-14 pb-32 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={`${rows.length} below threshold`}
        title="Restock"
      />

      {drafts.length > 0 ? (
        <section className="pb-12">
          <Label>Waiting on you</Label>
          <div className="mt-4 border-hairline border-t">
            {drafts.map((draft) => (
              <DraftRow
                busy={busy}
                draft={draft}
                key={draft.id}
                onApprove={approve.run}
                onReject={reject.run}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ManagerTable
        columns={columns}
        empty={
          <p className="t-body text-smoke">
            Nothing is below its threshold.
          </p>
        }
        rowKey={rowKey}
        rows={rows}
      />

      {/* The footer is the only place on this screen with a filled pill: one
          constructive action, at the end of the work. */}
      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-5 border-hairline border-t bg-void py-5">
        <span className="t-num-xs text-smoke">
          {selected.length} selected · estimated {formatPaise(estimate)}
        </span>
        <Pill
          disabled={selected.length === 0 || purchase.pending}
          onClick={onCreate}
          size="sm"
        >
          {/* It raises requests; it does not send anything to a supplier, and
              the label should not imply otherwise. */}
          Raise reorder requests
        </Pill>
      </div>
    </div>
  );
}

export { RestockScreen };
