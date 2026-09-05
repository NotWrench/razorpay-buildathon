import { AssistantDock } from "@/components/assistant/assistant-dock";
import { PageHeader } from "@/components/common/page-header";
import { MandatePanel } from "@/components/orders/mandate-panel";
import { OrderList } from "@/components/orders/order-list";
import { listBuyerOrders } from "@/lib/queries/orders";
import { findLiveMandate } from "@workspace/payments";
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

  /*
   * The buyer's standing authorisation sits with their orders rather than on a
   * settings screen, because it is only ever interesting next to the purchases
   * it did or did not pay for — and because withdrawing it is the thing
   * somebody comes looking for after seeing a charge they did not expect.
   */
  const mandate = await findLiveMandate({
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

        <MandatePanel
          mandate={
            mandate
              ? {
                  expiresAt: mandate.expiresAt.toISOString(),
                  id: mandate.id,
                  instrument: mandate.instrument,
                  maxPerOrderPaise: mandate.maxPerOrderPaise,
                  maxTotalPaise: mandate.maxTotalPaise,
                  spentPaise: mandate.spentPaise,
                }
              : null
          }
          slug={slug}
        />
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
