import {
  db,
  type Order,
  orderItems,
  orders,
  payments,
  products,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * A buyer's own orders.
 *
 * Every read here is filtered by `merchantId` *and* `buyerIdentifier`, the
 * same pair the agent tools and the money path filter on. A page never takes
 * an order id on its own — an id belonging to someone else resolves to
 * nothing, which is what §20 asks for.
 */

export interface OrderLine {
  name: string | null;
  productId: string;
  quantity: number;
  totalPaise: number;
  unitPricePaise: number;
}

export interface OrderDetail {
  lines: OrderLine[];
  order: Order;
  payments: (typeof payments.$inferSelect)[];
}

export interface OrderListEntry {
  itemCount: number;
  order: Order;
  summary: string;
}

export async function listBuyerOrders(params: {
  buyerIdentifier: string;
  limit?: number;
  merchantId: string;
}): Promise<OrderListEntry[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, params.merchantId),
        eq(orders.buyerIdentifier, params.buyerIdentifier)
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(params.limit ?? 25);

  if (rows.length === 0) {
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
        rows.map((order) => order.id)
      )
    );

  const grouped = new Map<string, typeof lines>();

  for (const line of lines) {
    const bucket = grouped.get(line.orderId) ?? [];

    bucket.push(line);
    grouped.set(line.orderId, bucket);
  }

  return rows.map((order) => {
    const own = grouped.get(order.id) ?? [];

    return {
      itemCount: own.reduce((sum, line) => sum + line.quantity, 0),
      order,
      summary: own
        .map((line) => `${line.quantity} × ${line.name ?? "item"}`)
        .join(", "),
    };
  });
}

export async function getBuyerOrder(params: {
  buyerIdentifier: string;
  merchantId: string;
  orderId: string;
}): Promise<OrderDetail | null> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, params.orderId),
      eq(orders.merchantId, params.merchantId),
      eq(orders.buyerIdentifier, params.buyerIdentifier)
    ),
  });

  if (!order) {
    return null;
  }

  const [lines, paymentRows] = await Promise.all([
    db
      .select({
        name: products.name,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        totalPaise: orderItems.subtotal,
        unitPricePaise: orderItems.unitPrice,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, order.id)),
    db.select().from(payments).where(eq(payments.orderId, order.id)),
  ]);

  return { lines, order, payments: paymentRows };
}
