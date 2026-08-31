import { getPendingAgentOrders, getSalesSummary } from "@workspace/ai";
import { campaigns, db, orderItems, products } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { MerchantChat } from "@/components/chat/merchant-chat";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { CampaignInbox } from "@/components/dashboard/campaign-inbox";
import { formatPaise } from "@/lib/format";
import { currentMerchant, currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The merchant dashboard.
 *
 * Two halves that mirror the two goals: the assistant that grows revenue, and
 * the queues where a human stays in the loop on everything that moves money.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  const merchant = user ? await currentMerchant() : null;

  // No sign-in or onboarding page exists yet, so say what is missing rather
  // than redirecting into a 404.
  if (!(user && merchant)) {
    return (
      <div className="mx-auto max-w-md p-8 text-sm">
        <h1 className="mb-2 font-semibold text-lg">Dashboard unavailable</h1>
        <p className="text-muted-foreground">
          {user
            ? "This account does not own a store yet. Create one with POST /api/merchants, or run bun run seed."
            : "Sign in as a merchant to see this page. The seed script creates merchant@example.com."}
        </p>
      </div>
    );
  }

  const [summary, pending, campaignRows] = await Promise.all([
    getSalesSummary(merchant.id, 30),
    getPendingAgentOrders(merchant.id),
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
    <div className="mx-auto flex h-svh max-w-7xl flex-col">
      <header className="flex items-baseline justify-between border-border border-b px-4 py-3">
        <div>
          <h1 className="font-semibold text-lg">{merchant.businessName}</h1>
          <p className="text-muted-foreground text-xs">
            {formatPaise(summary.revenuePaise)} in 30 days ·{" "}
            {summary.paidOrders} paid · {summary.failedOrders} failed
            {merchant.razorpayKeyId
              ? " · Razorpay connected"
              : " · platform keys"}
          </p>
        </div>
        <nav className="flex gap-4 text-xs">
          <Link
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            href={`/store/${merchant.storeSlug}`}
          >
            View storefront
          </Link>
        </nav>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
        <main className="min-h-0 border-border lg:border-r">
          <MerchantChat merchantId={merchant.id} />
        </main>

        <aside className="min-h-0 space-y-6 overflow-y-auto p-4">
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
        </aside>
      </div>
    </div>
  );
}
