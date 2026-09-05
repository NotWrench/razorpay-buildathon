import { db, orderItems, orders, payments, products } from "@workspace/db";
import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";

/**
 * Merchant analytics, computed on read.
 *
 * There is no rollup table: at store scale these aggregates are instant and can
 * never go stale, and a rollup would be one more thing to keep correct during a
 * demo. Revisit only if the dashboard actually feels slow.
 */

const PAID_STATUSES = ["paid"] as const;

function since(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

export interface SalesSummary {
  averageOrderValuePaise: number;
  failedOrders: number;
  paidOrders: number;
  pendingAgentOrders: number;
  revenuePaise: number;
  unitsSold: number;
  windowDays: number;
}

export async function getSalesSummary(
  merchantId: string,
  windowDays = 30
): Promise<SalesSummary> {
  const from = since(windowDays);

  const [paidRow] = await db
    .select({
      orders: count(orders.id),
      revenue: sum(orders.totalAmount),
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, PAID_STATUSES),
        gte(orders.createdAt, from)
      )
    );

  const [failedRow] = await db
    .select({ orders: count(orders.id) })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.orderStatus, "failed"),
        gte(orders.createdAt, from)
      )
    );

  const [pendingRow] = await db
    .select({ orders: count(orders.id) })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.approvalStatus, "pending_approval")
      )
    );

  const [unitsRow] = await db
    .select({ units: sum(orderItems.quantity) })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, PAID_STATUSES),
        gte(orders.createdAt, from)
      )
    );

  const paidOrders = Number(paidRow?.orders ?? 0);
  const revenuePaise = Number(paidRow?.revenue ?? 0);

  return {
    averageOrderValuePaise:
      paidOrders === 0 ? 0 : Math.round(revenuePaise / paidOrders),
    failedOrders: Number(failedRow?.orders ?? 0),
    paidOrders,
    pendingAgentOrders: Number(pendingRow?.orders ?? 0),
    revenuePaise,
    unitsSold: Number(unitsRow?.units ?? 0),
    windowDays,
  };
}

export interface ProductPerformance {
  category: string | null;
  name: string;
  pricePaise: number;
  productId: string;
  revenuePaise: number;
  stock: number;
  unitsSold: number;
}

/** Units sold per product over a window, including products that sold nothing. */
export async function getProductPerformance(
  merchantId: string,
  windowDays = 30
): Promise<ProductPerformance[]> {
  const from = since(windowDays);

  const sold = db
    .select({
      productId: orderItems.productId,
      revenue: sum(orderItems.subtotal).as("revenue"),
      units: sum(orderItems.quantity).as("units"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, PAID_STATUSES),
        gte(orders.createdAt, from)
      )
    )
    .groupBy(orderItems.productId)
    .as("sold");

  const rows = await db
    .select({
      category: products.category,
      name: products.name,
      price: products.price,
      productId: products.id,
      revenue: sold.revenue,
      stock: products.stock,
      units: sold.units,
    })
    .from(products)
    .leftJoin(sold, eq(sold.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  return rows
    .map((row) => ({
      category: row.category,
      name: row.name,
      pricePaise: row.price,
      productId: row.productId,
      revenuePaise: Number(row.revenue ?? 0),
      stock: row.stock,
      unitsSold: Number(row.units ?? 0),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);
}

/** Products holding stock that are not selling — the campaign candidates. */
export async function getSlowMovers(
  merchantId: string,
  windowDays = 30,
  limit = 10
): Promise<ProductPerformance[]> {
  const performance = await getProductPerformance(merchantId, windowDays);

  return performance
    .filter((row) => row.stock > 0)
    .sort((a, b) => a.unitsSold - b.unitsSold || b.stock - a.stock)
    .slice(0, limit);
}

export interface AttachRate {
  anchorName: string;
  anchorOrders: number;
  anchorProductId: string;
  attachedName: string;
  attachedProductId: string;
  attachRate: number;
  coOccurringOrders: number;
}

/**
 * How often product B appears in an order that contains product A.
 *
 * This is the evidence behind a bundle suggestion: "sleeves attach to laptops
 * at 4%" is a measured number, not the model's intuition.
 */
export async function getAttachRates(
  merchantId: string,
  options: {
    anchorProductId?: string;
    limit?: number;
    minAnchorOrders?: number;
  } = {}
): Promise<AttachRate[]> {
  const rows = await db.execute<{
    anchor_orders: number;
    anchor_product_id: string;
    attached_product_id: string;
    co_orders: number;
  }>(sql`
    with paid_items as (
      select oi.order_id, oi.product_id
      from ${orderItems} oi
      join ${orders} o on o.id = oi.order_id
      where o.merchant_id = ${merchantId} and o.order_status = 'paid'
    ),
    anchor_totals as (
      select product_id, count(distinct order_id)::int as anchor_orders
      from paid_items
      group by product_id
    )
    select
      a.product_id  as anchor_product_id,
      b.product_id  as attached_product_id,
      count(distinct a.order_id)::int as co_orders,
      t.anchor_orders
    from paid_items a
    join paid_items b
      on a.order_id = b.order_id and a.product_id <> b.product_id
    join anchor_totals t on t.product_id = a.product_id
    where t.anchor_orders >= ${options.minAnchorOrders ?? 2}
      ${options.anchorProductId ? sql`and a.product_id = ${options.anchorProductId}` : sql``}
    group by a.product_id, b.product_id, t.anchor_orders
    order by count(distinct a.order_id) desc
    limit ${options.limit ?? 20}
  `);

  const ids = new Set<string>();

  for (const row of rows) {
    ids.add(row.anchor_product_id);
    ids.add(row.attached_product_id);
  }

  if (ids.size === 0) {
    return [];
  }

  const named = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(inArray(products.id, [...ids]));

  const nameById = new Map(named.map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    anchorName: nameById.get(row.anchor_product_id) ?? "Unknown product",
    anchorOrders: Number(row.anchor_orders),
    anchorProductId: row.anchor_product_id,
    attachedName: nameById.get(row.attached_product_id) ?? "Unknown product",
    attachedProductId: row.attached_product_id,
    attachRate: Number(row.co_orders) / Number(row.anchor_orders),
    coOccurringOrders: Number(row.co_orders),
  }));
}

/** Products most often bought alongside the given one — drives cross-sell. */
export async function getFrequentlyBoughtWith(
  merchantId: string,
  productId: string,
  limit = 5
): Promise<AttachRate[]> {
  return await getAttachRates(merchantId, {
    anchorProductId: productId,
    limit,
    minAnchorOrders: 1,
  });
}

export interface PaymentHealth {
  authorized: number;
  captured: number;
  created: number;
  failed: number;
  refunded: number;
}

export async function getPaymentHealth(
  merchantId: string
): Promise<PaymentHealth> {
  const rows = await db
    .select({ status: payments.status, total: count(payments.id) })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(eq(orders.merchantId, merchantId))
    .groupBy(payments.status);

  const health: PaymentHealth = {
    authorized: 0,
    captured: 0,
    created: 0,
    failed: 0,
    refunded: 0,
  };

  for (const row of rows) {
    health[row.status] = Number(row.total);
  }

  return health;
}

export interface MissedAttach {
  anchorName: string;
  anchorProductId: string;
  attachedName: string;
  attachedProductId: string;
  /** How often the attachment does come along, when it does. */
  attachRatePercent: number;
  /** Orders with the anchor and without the attachment. */
  missedOrders: number;
  /** What those orders would have been worth at the attachment's price. */
  missedRevenuePaise: number;
}

/**
 * The cross-sell number a merchant will actually act on.
 *
 * `getAttachRates` says "sleeves attach to laptops in 4% of orders", which is
 * a fact and not yet a decision. This says the other 96% out loud and prices
 * it: the orders that carried the anchor and left the attachment behind, and
 * what they would have been worth. That is the gap a bundle is trying to close.
 *
 * Deliberately not a forecast. Nobody was going to buy the attachment on every
 * one of those orders, and the number is the size of the opportunity rather
 * than money anybody lost — which is what the tool says when it hands it over.
 */
export async function getMissedAttachOpportunities(
  merchantId: string,
  options: { limit?: number; minAttachRate?: number } = {}
): Promise<MissedAttach[]> {
  const rates = await getAttachRates(merchantId, { limit: 40 });

  const attachedIds = [
    ...new Set(rates.map((rate) => rate.attachedProductId)),
  ];

  if (attachedIds.length === 0) {
    return [];
  }

  const priced = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(inArray(products.id, attachedIds));

  const priceById = new Map(priced.map((row) => [row.id, row.price]));
  const floor = options.minAttachRate ?? 0.1;

  return rates
    .filter((rate) => rate.attachRate >= floor && rate.attachRate < 1)
    .map((rate) => {
      const missedOrders = rate.anchorOrders - rate.coOccurringOrders;

      return {
        anchorName: rate.anchorName,
        anchorProductId: rate.anchorProductId,
        attachedName: rate.attachedName,
        attachedProductId: rate.attachedProductId,
        attachRatePercent: Number((rate.attachRate * 100).toFixed(1)),
        missedOrders,
        missedRevenuePaise:
          missedOrders * (priceById.get(rate.attachedProductId) ?? 0),
      };
    })
    .filter((row) => row.missedOrders > 0)
    .sort((a, b) => b.missedRevenuePaise - a.missedRevenuePaise)
    .slice(0, options.limit ?? 10);
}

export interface AgentBuyerActivity {
  approvalRatePercent: number | null;
  approvedOrders: number;
  /** The API key id the orders were placed under. */
  buyerIdentifier: string;
  /** Value of the orders that were approved, in paise. */
  committedPaise: number;
  lastOrderAt: Date | null;
  pendingOrders: number;
  rejectedOrders: number;
  totalOrders: number;
}

/**
 * What each buying agent has actually done here.
 *
 * The merchant's side of the counterparty relationship. Approval rate is the
 * figure worth having: an agent whose orders are almost always approved is one
 * to raise the cap on, and an agent the merchant keeps rejecting is one to
 * revoke — and neither judgement was possible from anywhere in this system
 * before, because orders by agent were never grouped.
 *
 * Rejected orders are counted but contribute nothing to `committedPaise`. A
 * rejected order committed no money and counting it would make a key look
 * spent when it is untouched.
 */
export async function getAgentBuyerActivity(
  merchantId: string,
  windowDays = 90
): Promise<AgentBuyerActivity[]> {
  const rows = await db
    .select({
      approvalStatus: orders.approvalStatus,
      buyerIdentifier: orders.buyerIdentifier,
      lastAt: sql<Date>`max(${orders.createdAt})`,
      orders: count(orders.id),
      total: sum(orders.totalAmount),
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.buyerType, "ai_agent"),
        gte(orders.createdAt, since(windowDays))
      )
    )
    .groupBy(orders.buyerIdentifier, orders.approvalStatus);

  const byBuyer = new Map<string, AgentBuyerActivity>();

  for (const row of rows) {
    const entry = byBuyer.get(row.buyerIdentifier) ?? {
      approvalRatePercent: null,
      approvedOrders: 0,
      buyerIdentifier: row.buyerIdentifier,
      committedPaise: 0,
      lastOrderAt: null,
      pendingOrders: 0,
      rejectedOrders: 0,
      totalOrders: 0,
    };

    const orderCount = Number(row.orders);

    entry.totalOrders += orderCount;

    if (row.approvalStatus === "approved") {
      entry.approvedOrders += orderCount;
      entry.committedPaise += Number(row.total ?? 0);
    } else if (row.approvalStatus === "rejected") {
      entry.rejectedOrders += orderCount;
    } else {
      entry.pendingOrders += orderCount;
    }

    const at = row.lastAt ? new Date(row.lastAt) : null;

    if (at && (!entry.lastOrderAt || at > entry.lastOrderAt)) {
      entry.lastOrderAt = at;
    }

    byBuyer.set(row.buyerIdentifier, entry);
  }

  return [...byBuyer.values()]
    .map((entry) => {
      /*
       * Rate over *decided* orders only. Counting the pending ones as
       * unapproved would drag a good counterparty's score down purely because
       * the merchant has not got to their queue this morning.
       */
      const decided = entry.approvedOrders + entry.rejectedOrders;

      return {
        ...entry,
        approvalRatePercent:
          decided === 0
            ? null
            : Math.round((entry.approvedOrders / decided) * 100),
      };
    })
    .sort((a, b) => b.committedPaise - a.committedPaise);
}

export function getPendingAgentOrders(merchantId: string, limit = 25) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.approvalStatus, "pending_approval")
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
