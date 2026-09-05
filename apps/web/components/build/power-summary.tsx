import { cn } from "@workspace/ui/lib/utils";

/**
 * Draw against the supply the engine would pick.
 *
 * Two numbers and the gap between them, because "recommended 850 W" means
 * nothing without the draw it was recommended for.
 */
export function PowerSummary({
  className,
  estimatedWattage,
  psuWattage,
  recommendedPsuWattage,
}: {
  className?: string;
  estimatedWattage: number;
  psuWattage?: number | null;
  recommendedPsuWattage: number;
}) {
  if (estimatedWattage <= 0) {
    return null;
  }

  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      <span className="font-mono tabular-nums">{estimatedWattage} W</span> under
      load · supply of{" "}
      <span className="font-mono tabular-nums">{recommendedPsuWattage} W</span>{" "}
      recommended
    </p>
  );
}
