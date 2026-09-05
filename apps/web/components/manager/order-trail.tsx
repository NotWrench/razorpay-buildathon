"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useEffect, useState } from "react";

/**
 * One order's audit trail, in the row the merchant already opened.
 *
 * The buyer's copy of this is rendered on the server, because that page has
 * already loaded and authorised the order. Here the row is a client component
 * and the trail is only wanted for the one order somebody expanded, so it goes
 * over `GET /api/agent/trace/{orderId}` — the endpoint that has served exactly
 * this since the audit trail existed and that nothing had ever called.
 *
 * Fetched on expand rather than with the table. A merchant with sixty orders
 * should not pay sixty audit queries to look at one, and the trail is the
 * detail behind a decision rather than something scanned down a column.
 */

interface TraceRow {
  action: string;
  actorType: string;
  createdAt: string;
  explanation: string;
  id: string;
  metadata: { scheduled?: boolean } | null;
}

interface TraceFailure {
  createdAt: string;
  errorMessage: string;
  errorType: string;
  id: string;
  recoveryAction: string | null;
}

interface TraceResponse {
  data?: { auditTrail: TraceRow[]; failures: TraceFailure[] };
}

const ACTOR_WORD: Record<string, string> = {
  ai_assistant: "Assistant",
  external_ai_agent: "Buying agent",
  human_buyer: "Shopper",
  merchant: "You",
  system: "System",
};

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

/** Turns AUDIT_ACTION_NAMES into "Audit action names". */
function humanize(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The actions that record something not working. */
function isFailure(action: string): boolean {
  return (
    action.includes("FAILED") ||
    action.includes("BREACHED") ||
    action.includes("DENIED")
  );
}

function OrderTrail({ orderId }: { orderId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; trail: TraceResponse["data"] }
  >({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch(`/api/agent/trace/${orderId}`);

      if (!response.ok) {
        setState({
          message: "The trail could not be read.",
          status: "error",
        });

        return;
      }

      const body = (await response.json()) as TraceResponse;

      setState({ status: "ready", trail: body.data });
    } catch {
      setState({ message: "The trail could not be read.", status: "error" });
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="mt-6 border-hairline border-t pt-5">
        <Label>Audit trail</Label>
        <p className="t-body-sm mt-3 text-smoke">Reading…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-6 border-hairline border-t pt-5">
        <Label>Audit trail</Label>
        <p className="t-body-sm mt-3 text-smoke">{state.message}</p>
      </div>
    );
  }

  const entries = state.trail?.auditTrail ?? [];
  const failures = state.trail?.failures ?? [];

  return (
    <div className="mt-6 border-hairline border-t pt-5">
      <Label>Audit trail</Label>

      {entries.length === 0 && failures.length === 0 ? (
        <p className="t-body-sm mt-3 text-smoke">
          Nothing has been recorded against this order.
        </p>
      ) : null}

      <ol className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li className="flex gap-3" key={entry.id}>
            <span
              aria-hidden
              className={cn(
                "mt-2 size-1 shrink-0 rounded-full",
                isFailure(entry.action) ? "bg-lacquer" : "bg-smoke/60"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="t-body-sm flex flex-wrap items-baseline gap-x-2 text-bone">
                {humanize(entry.action)}
                <span className="t-num-xs text-smoke">
                  {ACTOR_WORD[entry.actorType] ?? entry.actorType} ·{" "}
                  {WHEN.format(new Date(entry.createdAt))}
                </span>
                {entry.metadata?.scheduled ? (
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-smoke uppercase tracking-[0.08em]">
                    unattended
                  </span>
                ) : null}
              </p>
              <p className="t-body-sm mt-0.5 text-smoke leading-relaxed">
                {entry.explanation}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/*
        Beside the successes, never in a separate place. A refund Razorpay
        refused belongs next to the refund that worked, and a merchant should
        not have to know to look somewhere else to find out what went wrong.
      */}
      {failures.length > 0 ? (
        <div className="mt-5 border-hairline border-t pt-4">
          <Label>What did not work</Label>
          <ul className="mt-3 space-y-3">
            {failures.map((failure) => (
              <li key={failure.id}>
                <p className="t-body-sm text-lacquer">
                  {humanize(failure.errorType)}
                </p>
                <p className="t-body-sm mt-0.5 text-smoke leading-relaxed">
                  {failure.errorMessage}
                </p>
                <p className="t-num-xs mt-0.5 text-smoke">
                  {WHEN.format(new Date(failure.createdAt))}
                  {failure.recoveryAction
                    ? ` · then: ${humanize(failure.recoveryAction)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { OrderTrail };
