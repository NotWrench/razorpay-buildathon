import type { Metadata } from "next";
import { OrdersScreen } from "@/components/manager/orders-screen";
import { getManagerOrders } from "@/lib/data";

/** Orders, and the two things you do to them. */

/**
 * Operational data, read on every request.
 *
 * Nothing on this page takes a cookie or a search param, so Next would
 * otherwise prerender it at build time and serve a stock count from whenever
 * the deploy happened. A manager screen that is quietly hours out of date is
 * worse than a slow one.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders · Manager" };

export default async function ManagerOrdersPage() {
  const orders = await getManagerOrders();

  return <OrdersScreen orders={orders} />;
}
