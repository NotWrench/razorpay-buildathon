"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import type { Finding } from "@/lib/data/types";

/**
 * What I'd do — at most three, ranked, and nothing if there is nothing.
 *
 * An operations agent that always finds something to say is one nobody trusts,
 * so an empty window says so in a line rather than promoting the fourth-most
 * interesting number to advice.
 *
 * Three cards abreast rather than three stacked rows: the findings used to be
 * the last thing above the composer and the reason it sat off-screen.
 *
 * Every action drafts. The pills are ghost, not solid: approving is a decision
 * and a filled red button is how a decision gets made by accident.
 */

const URGENCY_ORDER = { high: 0, low: 2, medium: 1 } as const;

function FindingCard({ finding }: { finding: Finding }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  const draft = useCallback(() => {
    toast(`Draft created. ${finding.action} — nothing has been sent.`);
  }, [finding.action]);

  return (
    <div className="flex flex-col rounded-[20px] border border-hairline bg-panel p-5">
      <div className="flex items-start gap-3">
        {/* Only the urgent one is marked. A dot on every card is a dot on
            none of them. */}
        <span
          aria-hidden
          className={cn(
            "mt-2 size-[5px] shrink-0 rounded-full",
            finding.urgency === "high" ? "bg-lacquer" : "bg-transparent"
          )}
        />
        <p className="t-body min-w-0 flex-1 text-bone">{finding.headline}</p>
      </div>

      <p className="t-body-sm mt-2 pl-[17px] text-smoke">{finding.action}</p>

      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="t-body-sm mt-4 flex items-center gap-1.5 self-start pl-[17px] text-smoke outline-none transition-colors duration-micro hover:text-bone focus-visible:text-bone"
        onClick={toggle}
        type="button"
      >
        Evidence
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 transition-transform duration-micro",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="evidence mt-4 pl-[17px]" id={panelId}>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {finding.evidence.map((row) => (
              <div key={row.label}>
                <Label as="dt">{row.label}</Label>
                <dd className="t-num-sm mt-1 text-bone">{row.value}</dd>
              </div>
            ))}
          </dl>
          {/* The window is part of the evidence. A number without the period
              it was measured over is not evidence at all. */}
          <p className="t-num-xs mt-3 text-smoke">{finding.window}</p>
        </div>
      ) : null}

      {finding.proposedAction ? (
        <div className="mt-5 pt-1 pl-[17px]">
          <Pill onClick={draft} size="sm" variant="ghost">
            {finding.proposedAction.label}
          </Pill>
        </div>
      ) : null}
    </div>
  );
}

function FindingsList({
  findings,
  title = "What I'd do",
}: {
  findings: Finding[];
  /** The thread reuses these cards under its own heading. */
  title?: string;
}) {
  const ranked = [...findings]
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])
    .slice(0, 3);

  return (
    <section>
      <Label>{title}</Label>

      {ranked.length === 0 ? (
        <p className="t-body mt-4 text-smoke">
          Nothing needs you in this window.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ranked.map((finding) => (
            <FindingCard finding={finding} key={finding.id} />
          ))}
        </div>
      )}
    </section>
  );
}

export { FindingsList };
