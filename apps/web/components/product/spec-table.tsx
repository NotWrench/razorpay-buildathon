import type { SpecEntry } from "@/lib/specs";

/**
 * The stated specifications.
 *
 * Only fields the merchant actually published appear. A blank row would read
 * as a zero, and the engine treats a missing spec as "cannot check" rather
 * than "fine" — so the page should not imply otherwise.
 */
export function SpecTable({
  caption,
  entries,
}: {
  caption?: string;
  entries: SpecEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This part has no published specifications, so compatibility checks
        against it will report insufficient data.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      {caption ? (
        <caption className="pb-2 text-left text-muted-foreground text-xs uppercase tracking-widest">
          {caption}
        </caption>
      ) : null}
      <tbody>
        {entries.map((entry) => (
          <tr
            className="border-border/60 border-b last:border-b-0"
            key={entry.label}
          >
            <th className="py-2 pr-4 text-left font-normal text-muted-foreground">
              {entry.label}
            </th>
            <td className="py-2 text-right tabular-nums">{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
