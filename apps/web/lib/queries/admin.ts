import { db, type Order, orderItems, orders, products } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";

/**
 * Store-wide order reads for the dashboard.
 *
 * Filtered by `merchantId` only — this is the merchant's own store, and the
 * ownership check happened in the layout before any of it ran. The buyer-side
 * reads in `./orders.ts` keep their extra `buyerIdentifier` filter for exactly
 * the reason these do not need one.
 */

export interface MerchantOrderRow {
  itemSummary: string;
  order: Order;
}

export async function listMerchantOrders(params: {
  limit?: number;
  merchantId: string;
  status?: string;
}): Promise<MerchantOrderRow[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.merchantId, params.merchantId))
    .orderBy(desc(orders.createdAt))
    .limit(params.limit ?? 50);

  const filtered = params.status
    ? rows.filter((order) => order.orderStatus === params.status)
    : rows;

  if (filtered.length === 0) {
    return [];
  }

  const lines = await db
    .select({
      name: products.name,
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(
      inArray(
        orderItems.orderId,
        filtered.map((order) => order.id)
      )
    );

  return filtered.map((order) => ({
    itemSummary: lines
      .filter((line) => line.orderId === order.id)
      .map((line) => `${line.quantity} × ${line.name ?? "item"}`)
      .join(", "),
    order,
  }));
}
