import { AssistantDock } from "@/components/assistant/assistant-dock";
import { PageHeader } from "@/components/common/page-header";
import { OrderList } from "@/components/orders/order-list";
import { listBuyerOrders } from "@/lib/queries/orders";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * The buyer's own orders.
 *
 * Scoped by merchant and buyer identifier, the same pair every order tool
 * filters on — a signed-out shopper sees the orders placed under their guest
 * identity and nobody else's.
 */
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();

  const entries = await listBuyerOrders({
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
  });

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader
          description={
            buyer.isGuest
              ? "You are shopping as a guest. Sign in to keep your orders across devices."
              : undefined
          }
          title="Your orders"
        />

        <OrderList entries={entries} slug={slug} />
      </main>

      <AssistantDock
        context={{ page: "order" }}
        initialMode="orders"
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
