import {
  getCancellationSummary,
  getOrderStatusSummary,
  getPaymentHealth,
} from "@workspace/ai";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { MerchantOrderTable } from "@/components/dashboard/merchant-order-table";
import { formatPaise } from "@/lib/format";
import { listMerchantOrders } from "@/lib/queries/admin";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Orders across the store, with what happened to the ones that did not land. */
export default async function DashboardOrdersPage() {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  const [summary, cancellations, health, rows] = await Promise.all([
    getOrderStatusSummary(merchant.id, 30),
    getCancellationSummary(merchant.id, 30),
    getPaymentHealth(merchant.id),
    listMerchantOrders({ limit: 50, merchantId: merchant.id }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Last ${summary.windowDays} days. Approval state and payment state are separate facts.`}
        title="Orders"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Awaiting approval"
          tone={summary.pendingApproval > 0 ? "warning" : "default"}
          value={summary.pendingApproval}
        />
        <StatTile label="Captured payments" value={health.captured} />
        <StatTile
          label="Failed payments"
          tone={health.failed > 0 ? "danger" : "default"}
          value={health.failed}
        />
        <StatTile
          hint={`${cancellations.cancelledOrders} cancelled order(s)`}
          label="Lost value"
          value={formatPaise(cancellations.valueLostPaise, merchant.currency)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By status</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {summary.byStatus.map((entry) => (
              <li
                className="rounded-md border border-border p-3"
                key={entry.status}
              >
                <p className="text-muted-foreground text-xs capitalize">
                  {entry.status}
                </p>
                <p className="font-semibold tabular-nums">{entry.count}</p>
                <p className="text-muted-foreground text-xs">
                  {formatPaise(entry.valuePaise, merchant.currency)}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {cancellations.reasons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Why orders did not complete</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {cancellations.reasons.map((reason) => (
                <li className="text-sm" key={reason.errorType}>
                  <span className="font-medium">{reason.errorType}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    × {reason.count} — {reason.sample}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <MerchantOrderTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
