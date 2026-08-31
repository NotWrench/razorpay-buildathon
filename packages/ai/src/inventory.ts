import {
  agentDb,
  db,
  failures,
  inventory,
  orderItems,
  orders,
  products,
} from "@workspace/db";
import { and, count, eq, gte, inArray, sum } from "drizzle-orm";

/**
 * Inventory and order intelligence for the merchant agent.
 *
 * §10 asks the admin agent to summarise operations and to state its
 * assumptions rather than present a derived number as a fact. That shapes
 * every return type here: a velocity is always accompanied by the window it
 * was measured over, and a product with no configured threshold is reported
 * as unconfigured rather than defaulted to something invented.
 *
 * Like `analytics.ts`, everything is computed on read. There is no rollup to
 * go stale during a demo.
 */

const PAID_STATUSES = ["paid"] as const;

/**
 * Days of cover below which a product is worth flagging.
 *
 * Three weeks, chosen so a merchant reviewing weekly sees a problem twice
 * before it bites. It is a floor, not the whole test: a product whose cover is
 * shorter than its supplier's lead time is at risk at any number, because the
 * replacement cannot arrive before the shelf empties.
 */
const RISK_DAYS_OF_COVER = 21;

function since(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

export interface InventorySummary {
  belowThreshold: number;
  distinctProducts: number;
  outOfStock: number;
  /** Retail value of everything on the shelf, in paise. */
  stockValuePaise: number;
  /** Products with no `low_stock_threshold` configured — not a zero. */
  unconfiguredProducts: number;
  unitsOnHand: number;
}

export async function getInventorySummary(
  merchantId: string
): Promise<InventorySummary> {
  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      price: products.price,
      stock: products.stock,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  return {
    belowThreshold: rows.filter(
      (row) =>
        row.lowStockThreshold !== null && row.stock <= row.lowStockThreshold
    ).length,
    distinctProducts: rows.length,
    outOfStock: rows.filter((row) => row.stock <= 0).length,
    stockValuePaise: rows.reduce(
      (total, row) => total + row.price * row.stock,
      0
    ),
    unconfiguredProducts: rows.filter((row) => row.lowStockThreshold === null)
      .length,
    unitsOnHand: rows.reduce((total, row) => total + row.stock, 0),
  };
}

export interface LowStockProduct {
  /** Null when nobody has configured one — not a zero. */
  lowStockThreshold: number | null;
  name: string;
  productId: string;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  sku: string | null;
  stock: number;
  supplierLeadTimeDays: number | null;
}

/** Products at or below their configured threshold, plus anything out of stock. */
export async function getLowStockProducts(
  merchantId: string,
  limit = 20
): Promise<LowStockProduct[]> {
  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      name: products.name,
      productId: products.id,
      reorderPoint: inventory.reorderPoint,
      reorderQuantity: inventory.reorderQuantity,
      sku: products.sku,
      stock: products.stock,
      supplierLeadTimeDays: inventory.supplierLeadTimeDays,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  return rows
    .filter(
      (row) =>
        row.stock <= 0 ||
        (row.lowStockThreshold !== null && row.stock <= row.lowStockThreshold)
    )
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit);
}

export interface OrderSummary {
  byStatus: { count: number; status: string; valuePaise: number }[];
  pendingApproval: number;
  windowDays: number;
}

/** Counts and value by order status — new, paid, failed, cancelled. */
export async function getOrderSummary(
  merchantId: string,
  windowDays = 30
): Promise<OrderSummary> {
  const from = since(windowDays);

  const rows = await db
    .select({
      orders: count(orders.id),
      status: orders.orderStatus,
      value: sum(orders.totalAmount),
    })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), gte(orders.createdAt, from)))
    .groupBy(orders.orderStatus);

  const [pending] = await db
    .select({ orders: count(orders.id) })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.approvalStatus, "pending_approval"),
        gte(orders.createdAt, from)
      )
    );

  return {
    byStatus: rows
      .map((row) => ({
        count: Number(row.orders),
        status: row.status,
        valuePaise: Number(row.value ?? 0),
      }))
      .sort((a, b) => b.count - a.count),
    pendingApproval: Number(pending?.orders ?? 0),
    windowDays,
  };
}

export interface CancellationSummary {
  cancelledOrders: number;
  /** Reasons as recorded, most frequent first. */
  reasons: { count: number; errorType: string; sample: string }[];
  valueLostPaise: number;
  windowDays: number;
}

/**
 * Why orders did not complete, from the failure trail.
 *
 * `failures` lives in the agent database and the orders it names live in the
 * project database, so this is two queries and a join in memory rather than
 * one statement — the cost of the split described in `packages/db/README.md`.
 */
export async function getCancellationSummary(
  merchantId: string,
  windowDays = 30
): Promise<CancellationSummary> {
  const from = since(windowDays);

  const cancelled = await db
    .select({ id: orders.id, total: orders.totalAmount })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, ["cancelled", "failed"]),
        gte(orders.createdAt, from)
      )
    );

  if (cancelled.length === 0) {
    return {
      cancelledOrders: 0,
      reasons: [],
      valueLostPaise: 0,
      windowDays,
    };
  }

  const rows = await agentDb
    .select({
      errorMessage: failures.errorMessage,
      errorType: failures.errorType,
    })
    .from(failures)
    .where(
      inArray(
        failures.orderId,
        cancelled.map((order) => order.id)
      )
    );

  const grouped = new Map<string, { count: number; sample: string }>();

  for (const row of rows) {
    const entry = grouped.get(row.errorType) ?? {
      count: 0,
      sample: row.errorMessage,
    };

    grouped.set(row.errorType, {
      count: entry.count + 1,
      sample: entry.sample,
    });
  }

  return {
    cancelledOrders: cancelled.length,
    reasons: [...grouped.entries()]
      .map(([errorType, entry]) => ({
        count: entry.count,
        errorType,
        sample: entry.sample,
      }))
      .sort((a, b) => b.count - a.count),
    valueLostPaise: cancelled.reduce((total, order) => total + order.total, 0),
    windowDays,
  };
}

export interface StockRisk {
  /** Units sold per day over the window. */
  dailyVelocity: number;
  /** Stock divided by daily velocity. Null when nothing has sold. */
  daysOfCover: number | null;
  leadTimeDays: number | null;
  name: string;
  productId: string;
  stock: number;
  /** True when cover is shorter than the supplier's lead time. */
  stocksOutBeforeResupply: boolean;
  unitsSold: number;
  windowDays: number;
}

/**
 * How long the shelf lasts at the current rate of sale.
 *
 * `daysOfCover` is null rather than infinite when nothing has sold, because
 * "this will never run out" and "nobody is buying it" are the same arithmetic
 * and opposite findings — one is a reorder candidate, the other a discount
 * candidate, and collapsing them would send the merchant the wrong way.
 */
export async function getStockRisk(
  merchantId: string,
  windowDays = 30,
  limit = 20
): Promise<StockRisk[]> {
  const from = since(windowDays);

  const sold = db
    .select({
      productId: orderItems.productId,
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
      leadTimeDays: inventory.supplierLeadTimeDays,
      name: products.name,
      productId: products.id,
      stock: products.stock,
      units: sold.units,
    })
    .from(products)
    .leftJoin(sold, eq(sold.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  return rows
    .map((row) => {
      const unitsSold = Number(row.units ?? 0);
      const dailyVelocity = unitsSold / windowDays;
      const daysOfCover =
        dailyVelocity > 0 ? Math.round(row.stock / dailyVelocity) : null;

      return {
        dailyVelocity: Number(dailyVelocity.toFixed(3)),
        daysOfCover,
        leadTimeDays: row.leadTimeDays,
        name: row.name,
        productId: row.productId,
        stock: row.stock,
        stocksOutBeforeResupply:
          daysOfCover !== null &&
          row.leadTimeDays !== null &&
          daysOfCover < row.leadTimeDays,
        unitsSold,
        windowDays,
      };
    })
    .filter(
      (row) => row.daysOfCover !== null && row.daysOfCover <= RISK_DAYS_OF_COVER
    )
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0))
    .slice(0, limit);
}
