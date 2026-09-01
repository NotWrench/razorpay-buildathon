import { cn } from "@workspace/ui/lib/utils";
import { formatPaise } from "@/lib/format";

/**
 * A price.
 *
 * Amounts are integer paise everywhere in this system, and the one way they
 * become text is here — a component rather than a call so every price on the
 * site is aligned, tabular and formatted the same way.
 */
export function Money({
  className,
  currency,
  paise,
  size = "default",
}: {
  className?: string;
  currency?: string;
  paise: number;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        size === "sm" && "text-sm",
        size === "default" && "font-semibold",
        size === "lg" && "font-semibold text-2xl",
        className
      )}
    >
      {formatPaise(paise, currency)}
    </span>
  );
}
