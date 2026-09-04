import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { cn } from "@workspace/ui/lib/utils";

/**
 * Everything the engine found, worst first.
 *
 * Each row is the message and, when there is something concrete to do, the
 * suggestion beneath it. A finding without an action is still worth printing;
 * an action invented to fill the space is not.
 */

const ORDER = { blocking: 0, info: 2, warning: 1 } as const;

export function IssueList({
  className,
  issues,
}: {
  className?: string;
  issues: CompatibilityIssue[];
}) {
  const shown = [...issues]
    .filter((issue) => issue.status !== "compatible")
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  if (shown.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>
        Every check passed.
      </p>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {shown.map((issue) => (
        <li key={`${issue.rule}-${issue.affectedProductIds.join("-")}`}>
          <p
            className={cn(
              "text-xs",
              issue.severity === "blocking"
                ? "text-destructive"
                : "text-foreground"
            )}
          >
            {issue.message}
          </p>
          {issue.suggestion ? (
            <p className="mt-0.5 text-muted-foreground text-xs">
              {issue.suggestion}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
