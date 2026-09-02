"use client";

import { ImageGround } from "@workspace/ui/components/image-ground";
import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductRender } from "@/components/common/product-render";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ManagerColumn } from "@/components/manager/manager-table";
import { ManagerTable } from "@/components/manager/manager-table";
import type { RestockDraft, RestockRow } from "@/lib/mock/types";

/**
 * What is running out, and what to do about it.
 *
 * The editable cells are real inputs, not spans that turn into inputs on
 * click: a number an operator is expected to change should be focusable with
 * Tab and typed into without a ceremony first.
 *
 * Drafts the assistant made on /manager arrive at the top with the reason it
 * made them. Approve and Reject are both ghost — approving somebody else's
 * suggestion is a decision, and a filled pill would be the page taking a side.
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
      className="h-8 w-20 rounded-full border border-hairline bg-transparent px-3 text-right font-mono text-[15px] text-bone tabular-nums outline-none transition-colors duration-[180ms] focus:border-bone"
      inputMode="numeric"
      onChange={change}
      value={value}
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
          "flex size-5 cursor-pointer items-center justify-center rounded-[6px] border transition-colors duration-[180ms]",
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-hairline border-b py-5">
      <ImageGround className="size-11 shrink-0 rounded-[10px] p-1.5">
        <ProductRender alt="" category={draft.product.category} />
      </ImageGround>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-bone">
          {draft.product.name} ·{" "}
          <span className="font-mono tabular-nums">{draft.quantity}</span> units
        </p>
        <p className="mt-1 text-[13px] text-smoke">{draft.provenance}</p>
      </div>

      <div className="flex shrink-0 gap-3">
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

function RestockScreen({
  drafts: initialDrafts,
  rows: initialRows,
}: {
  drafts: RestockDraft[];
  rows: RestockRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState<string[]>([]);

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

  const onApprove = useCallback((draft: RestockDraft) => {
    setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    toast(`Approved. ${draft.quantity} units of ${draft.product.name} queued.`);
  }, []);

  const onReject = useCallback((draft: RestockDraft) => {
    setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
    toast("Rejected. The assistant will not raise it again this window.");
  }, []);

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
    toast(
      `Purchase order drafted for ${selected.length} lines — ${formatPaise(estimate)}. Nothing has been sent.`
    );
  }, [estimate, selected.length]);

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
            <p className="truncate text-[15px] text-bone">{row.product.name}</p>
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
          <span className="font-mono text-[15px] text-amber tabular-nums">
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
        width: "8rem",
      },
      {
        align: "right",
        id: "suggested",
        label: "Suggested qty",
        render: (row) => (
          <NumberCell
            id={row.id}
            label={`Suggested quantity for ${row.product.name}`}
            onChange={onSuggested}
            value={row.suggested}
          />
        ),
        width: "9rem",
      },
    ],
    [onSuggested, onThreshold, onToggle, selected]
  );

  return (
    <div className="px-5 pt-14 pb-32 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={`${rows.length} below threshold`}
        title="Restock"
      />

      {drafts.length > 0 ? (
        <section className="pb-12">
          <Label>From the assistant</Label>
          <div className="mt-4 border-hairline border-t">
            {drafts.map((draft) => (
              <DraftRow
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
        columns={columns}
        empty={
          <p className="text-[16px] text-smoke">
            Nothing is below its threshold.
          </p>
        }
        rowKey={rowKey}
        rows={rows}
      />

      {/* The footer is the only place on this screen with a filled pill: one
          constructive action, at the end of the work. */}
      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-5 border-hairline border-t bg-void py-5">
        <span className="font-mono text-[13px] text-smoke tabular-nums">
          {selected.length} selected · estimated {formatPaise(estimate)}
        </span>
        <Pill disabled={selected.length === 0} onClick={onCreate} size="sm">
          Create purchase order
        </Pill>
      </div>
    </div>
  );
}

export { RestockScreen };
