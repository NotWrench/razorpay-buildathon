import {
  getInventorySummary,
  getPaymentHealth,
  getPendingAgentOrders,
  getProductPerformance,
  getSalesSummary,
  getSlowMovers,
} from "@workspace/ai";
import { campaigns, db, orderItems, products } from "@workspace/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { CampaignInbox } from "@/components/dashboard/campaign-inbox";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { formatPaise } from "@/lib/format";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The operational overview.
 *
 * Numbers first, then the two queues where a human stays in the loop on
 * everything that moves money: agent orders waiting for approval, and campaigns
 * the assistant drafted but has not been allowed to activate.
 */
export default async function DashboardPage() {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  const [summary, inventory, health, pending, performance, slow, campaignRows] =
    await Promise.all([
      getSalesSummary(merchant.id, 30),
      getInventorySummary(merchant.id),
      getPaymentHealth(merchant.id),
      getPendingAgentOrders(merchant.id),
      getProductPerformance(merchant.id, 30),
      getSlowMovers(merchant.id, 30, 5),
      db
        .select()
        .from(campaigns)
        .where(eq(campaigns.merchantId, merchant.id))
        .orderBy(desc(campaigns.createdAt)),
    ]);

  const items =
    pending.length > 0
      ? await db
          .select({
            name: products.name,
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(
            inArray(
              orderItems.orderId,
              pending.map((order) => order.id)
            )
          )
      : [];

  const queue = pending.map((order) => ({
    buyerIdentifier: order.buyerIdentifier,
    buyerType: order.buyerType,
    id: order.id,
    items: items
      .filter((item) => item.orderId === order.id)
      .map((item) => `${item.quantity} × ${item.name}`),
    reason: order.aiPurchaseReason,
    totalAmount: order.totalAmount,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Sales, stock and the decisions waiting on you — last ${summary.windowDays} days.`}
        title="Overview"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hint={`${summary.paidOrders} paid orders`}
          label="Revenue"
          value={formatPaise(summary.revenuePaise, merchant.currency)}
        />
        <StatTile
          hint={`${summary.unitsSold} units sold`}
          label="Average order"
          value={formatPaise(summary.averageOrderValuePaise, merchant.currency)}
        />
        <StatTile
          hint={`${health.failed} failed · ${health.refunded} refunded`}
          label="Payments captured"
          tone={health.failed > health.captured ? "danger" : "default"}
          value={health.captured}
        />
        <StatTile
          hint={`${inventory.outOfStock} out of stock · ${inventory.unconfiguredProducts} without a threshold`}
          label="Below threshold"
          tone={inventory.belowThreshold > 0 ? "warning" : "default"}
          value={inventory.belowThreshold}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ApprovalQueue orders={queue} />

        <CampaignInbox
          campaigns={campaignRows.map((campaign) => ({
            approvedByMerchant: campaign.approvedByMerchant,
            discountType: campaign.discountType,
            discountValue: campaign.discountValue,
            id: campaign.id,
            reason: campaign.aiGeneratedReason,
            status: campaign.status,
            title: campaign.title,
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Selling well</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTable
              rows={performance.slice(0, 5)}
              slug={merchant.storeSlug}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Not moving</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={slow} slug={merchant.storeSlug} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
