import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

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
 * value in mono on the right. Hairlines top and bottom hold the group
 * together without boxing it in.
 */
function SpecList({ className, rows }: SpecListProps) {
  return (
    <dl
      className={cn(
        "border-hairline border-t border-b [&>div+div]:border-hairline [&>div+div]:border-t",
        className
      )}
    >
      {rows.map((row) => (
        <div
          className="flex items-baseline justify-between gap-6 py-[7px]"
          key={row.label}
        >
          <Label as="dt">{row.label}</Label>
          <dd className="text-right font-mono text-[13px] text-bone tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type { SpecRow };
export { SpecList };
