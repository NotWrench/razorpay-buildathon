"use client";

import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { ManagerHeading } from "@/components/manager/manager-heading";
import type { ActivityEntry } from "@/lib/data/types";

/**
 * The store's ledger: every action, human and agent, in one stream.
 *
 * The brief asks for the audit trail to be shown, and until this screen the
 * only way to read it was to ask the assistant what the assistant had been
 * doing — which is the one source you would want to check it against.
 *
 * Human and agent actions are not split into two feeds. The question a
 * merchant has is "who changed this", and making them look in two places to
 * find out implies the two kinds of action differ in some way that matters.
 * They do not; the actor column says which, and the filter is there for when
 * that is the question.
 */

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "You", label: "You" },
  { id: "Assistant", label: "Assistant" },
  { id: "Buying agent", label: "Buying agents" },
  { id: "failed", label: "Did not work" },
];

function FilterPill({
  active,
  id,
  label,
  onSelect,
}: {
  active: boolean;
  id: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const click = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <Pill
      aria-pressed={active}
      className={cn(active && "border-bone bg-bone text-void hover:bg-bone")}
      onClick={click}
      size="sm"
      variant="ghost"
    >
      {label}
    </Pill>
  );
}

function ActivityScreen({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState("all");

  const shown = useMemo(() => {
    if (filter === "all") {
      return entries;
    }

    if (filter === "failed") {
      return entries.filter((entry) => entry.failed);
    }

    return entries.filter((entry) => entry.actor === filter);
  }, [entries, filter]);

  const failures = useMemo(
    () => entries.filter((entry) => entry.failed).length,
    [entries]
  );

  return (
    <div className="px-5 pt-14 pb-24 sm:px-8 lg:px-8 2xl:px-12">
      <ManagerHeading
        count={
          failures > 0
            ? `${entries.length} entries · ${failures} did not work`
            : `${entries.length} entries`
        }
        title="Activity"
      />

      <div className="flex flex-wrap gap-3 pb-8">
        {FILTERS.map((entry) => (
          <FilterPill
            active={filter === entry.id}
            id={entry.id}
            key={entry.id}
            label={entry.label}
            onSelect={setFilter}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="t-body-lg text-smoke">
          Nothing recorded in this view yet.
        </p>
      ) : (
        <div className="border-hairline border-t">
          {shown.map((entry) => (
            <div className="border-hairline border-b py-5" key={entry.id}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span
                  className={cn(
                    "t-body",
                    entry.failed ? "text-lacquer" : "text-bone"
                  )}
                >
                  {entry.action}
                </span>
                <span className="t-body-sm text-smoke">{entry.actor}</span>
                {entry.scheduled ? (
                  <span className="t-body-sm text-amber">while you slept</span>
                ) : null}
                {entry.orderRef ? (
                  <span className="font-mono text-[13px] text-smoke">
                    {entry.orderRef}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-[13px] text-smoke tabular-nums">
                  {entry.at}
                </span>
              </div>

              <p className="mt-1.5 t-body-sm text-smoke">{entry.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { ActivityScreen };
