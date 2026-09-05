import type { BuildValidation } from "@workspace/commerce/compatibility";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { CompatibilityStatusBadge } from "./compatibility-status";
import { IssueList } from "./issue-list";
import { PowerSummary } from "./power-summary";

/**
 * The engine's report, in full.
 *
 * Every check it could run is listed, passes included — the difference between
 * "this build is fine", "we could not check" and "this will not work" is the
 * whole point of §4, and a panel that only surfaced failures would collapse
 * the first two into silence.
 */
export function CompatibilityPanel({
  psuWattage,
  validation,
}: {
  psuWattage?: number | null;
  validation: BuildValidation;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Compatibility</CardTitle>
        <CompatibilityStatusBadge status={validation.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <PowerSummary
          estimatedWattage={validation.estimatedWattage}
          psuWattage={psuWattage}
          recommendedPsuWattage={validation.recommendedPsuWattage}
        />

        <IssueList issues={validation.issues} />

        <p className="border-border border-t pt-3 text-muted-foreground text-xs">
          {validation.canCheckout
            ? "Nothing blocks this build from being ordered."
            : "Checkout is blocked until the findings above are resolved. This is checked again when the order is created."}
        </p>
      </CardContent>
    </Card>
  );
}
