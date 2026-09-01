import type { ReactNode } from "react";

/**
 * A recommendation, with its evidence attached.
 *
 * Every candidate the recommendation engine returns carries a `rationale`, and
 * it is rendered verbatim: §11 asks for a problem, an action and a reason, and
 * a suggestion the merchant cannot audit is one they should not act on.
 */

export interface CandidateEntry {
  detail: ReactNode;
  id: string;
  name: string;
  rationale: string;
}

export function CandidateList({
  assumptions,
  entries,
  emptyNote,
}: {
  assumptions: string;
  emptyNote: string;
  entries: CandidateEntry[];
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyNote}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li
            className="border-border/60 border-b pb-3 last:border-b-0"
            key={entry.id}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-sm">{entry.name}</p>
              <div className="text-muted-foreground text-xs tabular-nums">
                {entry.detail}
              </div>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              {entry.rationale}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">{assumptions}</p>
    </div>
  );
}
