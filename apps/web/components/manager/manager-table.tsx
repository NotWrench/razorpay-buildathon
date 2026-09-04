"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type { MouseEvent, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

/**
 * The one table on the manager side.
 *
 * A real `<table>`: forty rows of products read by a screen reader are a table,
 * and a grid of divs with roles bolted on is the same thing with the semantics
 * hand-written and half-wrong. No borders, no zebra, no card — rows sit on
 * hairlines and the hovered row lifts to --carbon, which is the whole of its
 * chrome.
 *
 * Row actions appear on hover *and on focus*, because a control that only
 * exists under a pointer does not exist for the keyboard at all.
 */

export interface ManagerColumn<T> {
  align?: "right";
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Present makes the column sortable. */
  sort?: (a: T, b: T) => number;
  /** A column width: "44px", "auto", "8rem". */
  width: string;
}

interface ManagerTableProps<T> {
  /** Small glyph buttons, revealed on hover or focus. */
  actions?: (row: T) => ReactNode;
  columns: ManagerColumn<T>[];
  empty: ReactNode;
  /** Rendered beneath the row when it is open. */
  expanded?: (row: T) => ReactNode;
  onToggle?: (key: string) => void;
  openKey?: string | null;
  rowKey: (row: T) => string;
  rows: T[];
}

function ManagerTable<T>({
  actions,
  columns,
  empty,
  expanded,
  onToggle,
  openKey,
  rowKey,
  rows,
}: ManagerTableProps<T>) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [descending, setDescending] = useState(false);

  const onSort = useCallback(
    (id: string) => {
      setDescending((current) => (sortId === id ? !current : false));
      setSortId(id);
    },
    [sortId]
  );

  const ordered = useMemo(() => {
    const column = columns.find((entry) => entry.id === sortId);

    if (!column?.sort) {
      return rows;
    }

    const sorted = [...rows].sort(column.sort);

    return descending ? sorted.reverse() : sorted;
  }, [columns, descending, rows, sortId]);

  if (rows.length === 0) {
    return <div className="border-hairline border-t py-14">{empty}</div>;
  }

  const span = columns.length + (actions ? 1 : 0);

  return (
    <>
      <table className="hidden w-full border-hairline border-t md:table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
          {actions ? <col style={{ width: "4.5rem" }} /> : null}
        </colgroup>

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={cn(
                  "px-3 py-2.5 font-normal",
                  column.align === "right" ? "text-right" : "text-left"
                )}
                key={column.id}
                scope="col"
              >
                {column.sort ? (
                  <SortButton
                    active={sortId === column.id}
                    descending={descending}
                    id={column.id}
                    label={column.label}
                    onSort={onSort}
                  />
                ) : (
                  <Label>{column.label}</Label>
                )}
              </th>
            ))}
            {actions ? <th /> : null}
          </tr>
        </thead>

        <tbody>
          {ordered.map((row) => (
            <TableRow
              actions={actions}
              columns={columns}
              expanded={expanded}
              key={rowKey(row)}
              onToggle={onToggle}
              open={openKey === rowKey(row)}
              row={row}
              rowKey={rowKey(row)}
              span={span}
            />
          ))}
        </tbody>
      </table>

      {/* Below md the same rows stack. Six columns in 390px is not a table, it
        is a word search — so each row becomes a block of labelled values, and
        the actions stop hiding behind a hover that touch does not have. */}
      <ul className="border-hairline border-t md:hidden">
        {ordered.map((row) => (
          <StackedRow
            actions={actions}
            columns={columns}
            expanded={expanded}
            key={rowKey(row)}
            onToggle={onToggle}
            open={openKey === rowKey(row)}
            row={row}
            rowKey={rowKey(row)}
          />
        ))}
      </ul>
    </>
  );
}

function StackedRow<T>({
  actions,
  columns,
  expanded,
  onToggle,
  open,
  row,
  rowKey,
}: {
  actions?: (row: T) => ReactNode;
  columns: ManagerColumn<T>[];
  expanded?: (row: T) => ReactNode;
  onToggle?: (key: string) => void;
  open: boolean;
  row: T;
  rowKey: string;
}) {
  const toggle = useCallback(() => onToggle?.(rowKey), [onToggle, rowKey]);
  const [lead, ...rest] = columns;

  return (
    <li className="border-hairline border-b px-1 py-4">
      {onToggle ? (
        <button
          aria-expanded={open}
          className="w-full text-left outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-4"
          onClick={toggle}
          type="button"
        >
          {lead ? lead.render(row) : null}
        </button>
      ) : (
        lead?.render(row)
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
        {rest.map((column) => (
          <div
            className="flex items-baseline justify-between gap-3"
            key={column.id}
          >
            {column.label ? <Label as="dt">{column.label}</Label> : null}
            <dd>{column.render(row)}</dd>
          </div>
        ))}
      </dl>

      {actions ? (
        <div className="mt-3 flex justify-end gap-1">{actions(row)}</div>
      ) : null}

      {open && expanded ? (
        <div className="order-lines mt-4">{expanded(row)}</div>
      ) : null}
    </li>
  );
}

function TableRow<T>({
  actions,
  columns,
  expanded,
  onToggle,
  open,
  row,
  rowKey,
  span,
}: {
  actions?: (row: T) => ReactNode;
  columns: ManagerColumn<T>[];
  expanded?: (row: T) => ReactNode;
  onToggle?: (key: string) => void;
  open: boolean;
  row: T;
  rowKey: string;
  span: number;
}) {
  const toggle = useCallback(() => onToggle?.(rowKey), [onToggle, rowKey]);

  return (
    <>
      <tr
        className={cn(
          "group border-hairline border-t transition-colors duration-micro",
          "focus-within:bg-carbon hover:bg-carbon",
          open && "bg-carbon"
        )}
        /*
         * The keyboard path is the button in the first cell, which carries
         * aria-expanded. This is the pointer convenience on top of it — the
         * whole row being clickable is what an operator expects, and it adds
         * no behaviour that the keyboard cannot already reach.
         */
        onClick={onToggle ? toggle : undefined}
      >
        {columns.map((column, index) => (
          <td
            className={cn(
              "px-3 py-3 align-middle",
              column.align === "right" ? "text-right" : "text-left",
              index === 0 && "rounded-l-[12px]"
            )}
            key={column.id}
          >
            {column.render(row)}
          </td>
        ))}

        {actions ? (
          <td className="rounded-r-[12px] px-3 py-3">
            <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-micro focus-within:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
              {actions(row)}
            </div>
          </td>
        ) : null}
      </tr>

      {open && expanded ? (
        <tr className="border-hairline border-t bg-carbon">
          <td className="px-3 pt-1 pb-5" colSpan={span}>
            <div className="order-lines">{expanded(row)}</div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SortButton({
  active,
  descending,
  id,
  label,
  onSort,
}: {
  active: boolean;
  descending: boolean;
  id: string;
  label: string;
  onSort: (id: string) => void;
}) {
  const click = useCallback(() => onSort(id), [id, onSort]);

  return (
    <button
      className="inline-flex items-center gap-1.5 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-4"
      onClick={click}
      type="button"
    >
      <Label className={active ? "text-bone" : undefined}>{label}</Label>
      {active ? (
        <span aria-hidden className="t-num-xs text-bone">
          {descending ? "▼" : "▲"}
        </span>
      ) : null}
    </button>
  );
}

/** A row action: a glyph that only says what it is to a screen reader. */
function RowAction({
  children,
  label,
  onClick,
  tone,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "lacquer";
}) {
  /* The row itself may be a toggle. Pressing an action is not asking for that. */
  const click = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onClick();
    },
    [onClick]
  );

  return (
    <button
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-colors duration-micro",
        "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone focus-visible:outline-offset-2",
        tone === "lacquer"
          ? "text-smoke hover:text-lacquer"
          : "text-smoke hover:text-bone"
      )}
      onClick={click}
      type="button"
    >
      {children}
    </button>
  );
}

export { ManagerTable, RowAction };
