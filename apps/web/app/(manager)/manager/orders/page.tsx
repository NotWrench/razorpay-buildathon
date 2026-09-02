import type { Metadata } from "next";
import { OrdersScreen } from "@/components/manager/orders-screen";
import { getManagerOrders } from "@/lib/mock";

/** Orders, and the two things you do to them. */

export const metadata: Metadata = { title: "Orders · Manager" };

export default async function ManagerOrdersPage() {
  const orders = await getManagerOrders();

  return <OrdersScreen orders={orders} />;
}
