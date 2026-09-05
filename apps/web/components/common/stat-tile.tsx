import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * One headline number.
 *
 * `hint` is where the number's provenance goes — the window it covers, the
 * count behind the ratio. A figure the merchant cannot trace is a figure they
 * will not act on.
 */
export function StatTile({
  className,
  hint,
  label,
  tone = "default",
  value,
}: {
  className?: string;
  hint?: ReactNode;
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
  value: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border border-border p-4", className)}>
      <p className="t-label text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-semibold text-xl tabular-nums",
          tone === "warning" && "text-amber",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-verdant"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
