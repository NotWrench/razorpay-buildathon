import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared chrome for the things an agent says with structure rather than prose.
 *
 * Anything involving money gets a card, never a paragraph: a total buried in a
 * sentence is a total nobody checks.
 */

export function ToolCard({
  children,
  className,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 text-sm",
        tone === "neutral" && "border-border",
        tone === "warning" && "border-amber/50 bg-amber/5",
        tone === "danger" && "border-destructive/50 bg-destructive/5",
        tone === "success" && "border-verdant/50 bg-verdant/5",
        className
      )}
    >
      {title ? (
        <p className="t-label mb-2 text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** A quiet single-line status, for tool calls still in flight. */
export function ToolStatus({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
      {children}
    </p>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  // A confidence that is not a number means the tool's shape and this card's
  // reading of it have drifted apart. Rendering "NaN% confident" is the worst
  // of both: it looks like a number, so it survives review, and it tells the
  // buyer nothing. Say there is no score instead — and say nothing about how
  // good the match is, because we no longer know.
  if (!Number.isFinite(value)) {
    return (
      <span
        className="t-label rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground"
        title="No confidence score was reported for this match"
      >
        no score
      </span>
    );
  }

  const percent = Math.round(value * 100);

  return (
    <span
      className={cn(
        "t-label rounded-sm px-1.5 py-0.5",
        percent >= 80 &&
          "bg-verdant/10 text-verdant",
        percent >= 50 &&
          percent < 80 &&
          "bg-amber/10 text-amber",
        percent < 50 && "bg-muted text-muted-foreground"
      )}
      title="How confident the assistant is in this match"
    >
      {percent}% confident
    </span>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <ToolCard title="That did not work" tone="danger">
      <p className="text-foreground">{message}</p>
    </ToolCard>
  );
}
