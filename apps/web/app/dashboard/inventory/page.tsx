import {
  getInventorySummary,
  getLowStockProducts,
  getStockRisk,
} from "@workspace/ai";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { LowStockTable } from "@/components/dashboard/low-stock-table";
import { StockRiskTable } from "@/components/dashboard/stock-risk-table";
import { formatPaise } from "@/lib/format";
import { currentMerchant } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Stock health: what is on the shelf, what is running out, and how fast. */
export default async function InventoryPage() {
  const merchant = await currentMerchant();

  if (!merchant) {
    return null;
  }

  const [summary, lowStock, risk] = await Promise.all([
    getInventorySummary(merchant.id),
    getLowStockProducts(merchant.id, 20),
    getStockRisk(merchant.id, 30, 20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="On-hand stock is authoritative in the platform database; thresholds and lead times are what make it actionable."
        title="Inventory"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hint={`${summary.distinctProducts} products`}
          label="Units on hand"
          value={summary.unitsOnHand}
        />
        <StatTile
          label="Stock value"
          value={formatPaise(summary.stockValuePaise, merchant.currency)}
        />
        <StatTile
          label="Below threshold"
          tone={summary.belowThreshold > 0 ? "warning" : "default"}
          value={summary.belowThreshold}
        />
        <StatTile
          hint={`${summary.unconfiguredProducts} have no threshold configured`}
          label="Out of stock"
          tone={summary.outOfStock > 0 ? "danger" : "default"}
          value={summary.outOfStock}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low stock</CardTitle>
        </CardHeader>
        <CardContent>
          <LowStockTable rows={lowStock} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Days of cover</CardTitle>
        </CardHeader>
        <CardContent>
          <StockRiskTable rows={risk} />
        </CardContent>
      </Card>
    </div>
  );
}
