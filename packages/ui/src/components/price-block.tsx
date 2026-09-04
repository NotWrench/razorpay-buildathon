import { formatPaise } from "@workspace/ui/lib/money";
import { cn } from "@workspace/ui/lib/utils";

interface PriceBlockProps {
  className?: string;
  compareAtPaise?: number;
  pricePaise: number;
  size?: "sm" | "md" | "lg";
}

const PRICE_SIZE = {
  lg: "t-num-lg",
  md: "t-num-md",
  sm: "t-num-sm",
} as const;

const COMPARE_SIZE = {
  lg: "t-num-sm",
  md: "t-num-xs",
  sm: "t-num-xs",
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
        className={cn("text-bone", PRICE_SIZE[size])}
      >
        {formatPaise(pricePaise)}
      </span>

      {compareAtPaise ? (
        <span
          className={cn("text-smoke line-through", COMPARE_SIZE[size])}
        >
          {formatPaise(compareAtPaise)}
        </span>
      ) : null}

      {saving ? (
        <span
          className={cn("text-lacquer", COMPARE_SIZE[size])}
        >
          Save {formatPaise(saving)}
        </span>
      ) : null}
    </div>
  );
}

export { PriceBlock };
