import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";

interface PriceBlockProps {
  className?: string;
  compareAtPaise?: number;
  pricePaise: number;
  size?: "sm" | "md" | "lg";
}

const PRICE_SIZE = {
  lg: "text-[28px]",
  md: "text-[21px]",
  sm: "text-[15px]",
} as const;

const COMPARE_SIZE = {
  lg: "text-[15px]",
  md: "text-[13px]",
  sm: "text-[13px]",
} as const;

/**
 * Price, compare-at and saving in one block.
 *
 * Strikethrough pricing is normal on a premium PC store and doesn't cheapen
 * it — banning it was an over-correction. The saving is one of the screen's
 * five reds; the struck price stays quiet in smoke.
 */
function PriceBlock({
  className,
  compareAtPaise,
  pricePaise,
  size = "md",
}: PriceBlockProps) {
  const saving =
    compareAtPaise && compareAtPaise > pricePaise
      ? compareAtPaise - pricePaise
      : null;

  return (
    <div
      className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}
    >
      <span
        className={cn(
          "font-mono text-bone tabular-nums leading-none",
          PRICE_SIZE[size]
        )}
      >
        {formatPaise(pricePaise)}
      </span>

      {compareAtPaise ? (
        <span
          className={cn(
            "font-mono text-smoke tabular-nums line-through",
            COMPARE_SIZE[size]
          )}
        >
          {formatPaise(compareAtPaise)}
        </span>
      ) : null}

      {saving ? (
        <span
          className={cn(
            "font-mono text-lacquer tabular-nums",
            COMPARE_SIZE[size]
          )}
        >
          Save {formatPaise(saving)}
        </span>
      ) : null}
    </div>
  );
}

export { PriceBlock };
