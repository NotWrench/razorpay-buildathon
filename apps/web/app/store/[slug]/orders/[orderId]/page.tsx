import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { notFound } from "next/navigation";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { PageHeader } from "@/components/common/page-header";
import { OrderLines } from "@/components/orders/order-lines";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTrail } from "@/components/orders/order-trail";
import { PaymentHistory } from "@/components/orders/payment-history";
import { ResumePaymentButton } from "@/components/orders/resume-payment-button";
import { getOrderTrail } from "@/lib/data/activity";
import { formatDateTime } from "@/lib/format";
import { getBuyerOrder } from "@/lib/queries/orders";
import { currentBuyer } from "@/lib/store/buyer";
import { requireStore } from "@/lib/store/context";

export const dynamic = "force-dynamic";

/**
 * One order.
 *
 * The page states what the backend recorded and nothing more: an approval the
 * merchant has not given, a payment the gateway has not captured, and a
 * failure reason if there is one. §21's rule is that the payment state comes
 * from the payment system, so this never infers it from having been here.
 *
 * The audit trail at the foot is the same record `/api/agent/trace/{orderId}`
 * serves, and it is the buyer's copy rather than the merchant's — the person
 * whose money it is should not have to ask the shop what happened to their own
 * order. Failures appear in it beside the successes, including ones this buyer
 * caused, because a trail that only shows what worked is one nobody should
 * trust.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string; slug: string }>;
}) {
  const { orderId, slug } = await params;
  const merchant = await requireStore(slug);
  const buyer = await currentBuyer();

  const detail = await getBuyerOrder({
    buyerIdentifier: buyer.identifier,
    merchantId: merchant.id,
    orderId,
  });

  if (!detail) {
    notFound();
  }

  const { lines, order, payments } = detail;

  /* Loaded after `getBuyerOrder` has established this order is theirs.
     `getOrderTrail` checks nothing itself — see the note on it. */
  const trail = await getOrderTrail(order.id);

  const payable =
    order.approvalStatus === "approved" &&
    order.orderStatus !== "paid" &&
    order.orderStatus !== "cancelled" &&
    Boolean(order.razorpayOrderId);

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          actions={
            payable ? (
              <ResumePaymentButton
                orderId={order.id}
                slug={slug}
                storeName={merchant.businessName}
              />
            ) : undefined
          }
          description={`Placed ${formatDateTime(order.createdAt)}`}
          title={`Order ${order.id.slice(0, 8)}`}
        />

        <div className="mb-4">
          <OrderStatusBadge
            approvalStatus={order.approvalStatus}
            orderStatus={order.orderStatus}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderLines
                currency={order.currency}
                discountPaise={order.discountAmount}
                lines={lines}
                subtotalPaise={order.subtotal}
                totalPaise={order.totalAmount}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentHistory payments={payments} />
            </CardContent>
          </Card>
        </div>

        {order.aiPurchaseReason ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Why this was bought</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {order.aiPurchaseReason}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTrail trail={trail} />
          </CardContent>
        </Card>
      </main>

      <AssistantDock
        context={{ orderId: order.id, page: "order" }}
        initialMode="orders"
        slug={slug}
        storeName={merchant.businessName}
      />
    </>
  );
}
