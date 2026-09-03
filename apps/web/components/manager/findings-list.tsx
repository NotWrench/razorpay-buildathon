"use client";

import { Label } from "@workspace/ui/components/label";
import { Pill } from "@workspace/ui/components/pill";
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
 * Every action drafts. The pills are ghost, not solid: approving is a decision
 * and a filled red button is how a decision gets made by accident.
 */

const URGENCY_ORDER = { high: 0, low: 2, medium: 1 } as const;

function FindingRow({ finding }: { finding: Finding }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  const draft = useCallback(() => {
    toast(`Draft created. ${finding.action} — nothing has been sent.`);
  }, [finding.action]);

  return (
    <div className="border-hairline border-b py-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] text-bone">{finding.headline}</p>
          <p className="mt-1.5 text-[15px] text-smoke">{finding.action}</p>

          <button
            aria-controls={panelId}
            aria-expanded={open}
            className="mt-3 flex items-center gap-1.5 text-[13px] text-smoke outline-none transition-colors duration-[180ms] hover:text-bone focus-visible:text-bone"
            onClick={toggle}
            type="button"
          >
            Evidence
            <ChevronDown
              aria-hidden
              className={
                open
                  ? "size-3.5 rotate-180 transition-transform duration-[180ms]"
                  : "size-3.5 transition-transform duration-[180ms]"
              }
            />
          </button>

          {open ? (
            <div className="evidence mt-4" id={panelId}>
              <dl className="flex flex-wrap gap-x-10 gap-y-3">
                {finding.evidence.map((row) => (
                  <div key={row.label}>
                    <Label as="dt">{row.label}</Label>
                    <dd className="mt-1 font-mono text-[15px] text-bone tabular-nums">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {/* The window is part of the evidence. A number without the
                  period it was measured over is not evidence at all. */}
              <p className="mt-3 font-mono text-[13px] text-smoke tabular-nums">
                {finding.window}
              </p>
            </div>
          ) : null}
        </div>

        {finding.proposedAction ? (
          <Pill className="shrink-0" onClick={draft} size="sm" variant="ghost">
            {finding.proposedAction.label}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}

function FindingsList({
  findings,
  title = "What I'd do",
}: {
  findings: Finding[];
  /** The thread reuses these rows under its own heading. */
  title?: string;
}) {
  const ranked = [...findings]
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])
    .slice(0, 3);

  return (
    <section>
      <Label>{title}</Label>

      {ranked.length === 0 ? (
        <p className="mt-5 text-[16px] text-smoke">
          Nothing needs you in this window.
        </p>
      ) : (
        <div className="mt-5 border-hairline border-t">
          {ranked.map((finding) => (
            <FindingRow finding={finding} key={finding.id} />
          ))}
        </div>
      )}
    </section>
  );
}

export { FindingsList };
