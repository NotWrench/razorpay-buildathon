import { Label } from "@workspace/ui/components/label";

interface SpecRow {
  label: string;
  value: string;
}

interface SpecListProps {
  className?: string;
  rows: SpecRow[];
}

/**
 * The labelled block a buyer decides from — label in small caps on the left,
 * value in mono on the right.
 *
 * This used to be held together by three separate rules: one above the group,
 * one below it, and one between every pair of rows. Four specs meant six
 * lines, which is what the whole table amounted to when you looked away from
 * it. What separates the rows now is the pairing itself — grey label hard
 * left, white value hard right, on a wide gutter — and that only reads if the
 * rows are far enough apart, hence the padding.
 */
function SpecList({ className, rows }: SpecListProps) {
  return (
    <dl className={className}>
      {rows.map((row) => (
        <div
          className="flex items-baseline justify-between gap-6 py-2.5"
          key={row.label}
        >
          <Label as="dt">{row.label}</Label>
          <dd className="t-num-xs text-right text-bone">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { SpecRow };
export { SpecList };
