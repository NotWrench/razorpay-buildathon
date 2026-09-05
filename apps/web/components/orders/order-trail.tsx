import type { OrderTrail as Trail } from "@/lib/data/types";

/**
 * What happened to this order, and what was done when something went wrong.
 *
 * The audit trail has always been written and, until now, only ever read
 * store-wide. But the question anyone actually has is about *one* order —
 * "why is this still waiting", "what did the agent think it was buying",
 * "what did the bank say" — and a merchant-wide feed answers that badly.
 *
 * Failures are shown inline, with the recovery beside them rather than in a
 * separate list. A refund Razorpay refused and the retry link that followed
 * are one event to anyone reading this. Nothing is hidden because it went
 * wrong: a trail that only records successes is a trail nobody should trust,
 * and a refusal that names its own numbers is the most convincing thing on
 * this page.
 */
export function OrderTrail({ trail }: { trail: Trail }) {
  const { entries, failures } = trail;

  if (entries.length === 0 && failures.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing has been recorded against this order yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {entries.map((entry) => (
          <li className="flex gap-3" key={entry.id}>
            <span
              aria-hidden
              className={
                entry.failed
                  ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                  : "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
              }
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground text-xs">
                  {entry.actor} · {entry.at}
                </span>
                {entry.scheduled ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                    unattended
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                {entry.explanation}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {failures.length > 0 ? (
        <div className="border-border/60 border-t pt-3">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            What did not work
          </p>
          <ul className="mt-2 space-y-2">
            {failures.map((failure) => (
              <li key={failure.id}>
                <p className="text-destructive text-sm">{failure.type}</p>
                <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                  {failure.message}
                </p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {failure.at}
                  {failure.recovery ? ` · then: ${failure.recovery}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
