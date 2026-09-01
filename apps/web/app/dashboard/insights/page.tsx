import {
  getAttachRates,
  getDiscontinueCandidates,
  getDiscountCandidates,
  getReorderCandidates,
} from "@workspace/ai";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { PageHeader } from "@/components/common/page-header";
import { CandidateList } from "@/components/dashboard/candidate-list";
import { formatPaise } from "@/lib/format";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * What to do this week.
 *
 * These are the same computations the operations agent reads through its
 * tools, rendered directly — the merchant should be able to reach the
 * recommendation without asking for it, and the agent's version should agree
 * with this one because both come from the same functions.
 *
 * Nothing here mutates. Discontinuation in particular is a recommendation and
 * never an action, which is why there is no button beside it.
 */
export default async function InsightsPage() {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  const [reorder, discount, discontinue, attachRates] = await Promise.all([
    getReorderCandidates(merchant.id, 30, 10),
    getDiscountCandidates(merchant.id, 30, 10),
    getDiscontinueCandidates(merchant.id, 90, 8),
    getAttachRates(merchant.id, { limit: 8 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Computed from real orders, with the window and the assumptions stated. The assistant reads exactly these numbers."
        title="Insights"
      />

      <Card>
        <CardHeader>
          <CardTitle>Reorder ({reorder.windowDays} days)</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateList
            assumptions={reorder.assumptions}
            emptyNote="Nothing is selling fast enough to need reordering."
            entries={reorder.candidates.map((candidate) => ({
              detail: `${candidate.stock} in stock · ${candidate.daysOfCover.toFixed(0)} d cover · order ${candidate.suggestedQuantity}`,
              id: candidate.productId,
              name: candidate.name,
              rationale: candidate.rationale,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount ({discount.windowDays} days)</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateList
            assumptions={discount.assumptions}
            emptyNote="No stock is sitting long enough to justify a discount."
            entries={discount.candidates.map((candidate) => ({
              detail: `${candidate.stock} in stock · ${formatPaise(candidate.stockValuePaise, merchant.currency)} tied up`,
              id: candidate.productId,
              name: candidate.name,
              rationale: candidate.rationale,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discontinue ({discontinue.windowDays} days)</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateList
            assumptions={discontinue.assumptions}
            emptyNote="Everything has earned its shelf space over this window."
            entries={discontinue.candidates.map((candidate) => ({
              detail: `${candidate.unitsSold} sold · ${formatPaise(candidate.revenuePaise, merchant.currency)} revenue`,
              id: candidate.productId,
              name: candidate.name,
              rationale: candidate.rationale,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bought together</CardTitle>
        </CardHeader>
        <CardContent>
          {attachRates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Not enough multi-item orders yet to measure an attach rate.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {attachRates.map((rate) => (
                <li key={`${rate.anchorProductId}-${rate.attachedProductId}`}>
                  <span className="font-medium tabular-nums">
                    {Math.round(rate.attachRate * 100)}%
                  </span>{" "}
                  <span className="text-muted-foreground">
                    of {rate.anchorName} orders also had {rate.attachedName} (
                    {rate.coOccurringOrders}/{rate.anchorOrders})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
