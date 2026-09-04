import {
  getLowStockProducts,
  getProductPerformance,
  getSalesSummary,
  getStockRisk,
} from "@workspace/ai";
import {
  cartItems,
  carts,
  db,
  inventory,
  orderItems,
  orders,
  productSpecs,
  products,
  reorderRequests,
  user,
} from "@workspace/db";
import { formatPaise } from "@workspace/ui/lib/money";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { cache } from "react";
import { currentUser } from "@/lib/session";
import { orderRef } from "./account";
import { toSummary } from "./product";
import { requireDefaultStore, storeId } from "./store";
import type {
  Finding,
  ManagerOrder,
  ManagerOrderState,
  ManagerProduct,
  ManagerRange,
  ManagerSummary,
  NeverSeenRow,
  ProductSummary,
  RestockDraft,
  RestockRow,
  SeenNotBoughtRow,
  SellingRow,
  StoreSettings,
} from "./types";

/**
 * The manager's five screens, over real store data.
 *
 * Two things are deliberately *not* here, because the platform does not
 * record them: page views and fulfilment. A "seen but not bought" block needs
 * an impression log, and "delivered" needs a shipment. Rather than invent
 * either, the two blocks that wanted them ask questions this database can
 * answer — how often a part reached a cart, and how long a part has sat
 * without ever being ordered — and the screens say so in their own titles.
 */

const DAY_MS = 86_400_000;

/** Six points across the window, which is all a sparkline can honestly hold. */
const TREND_BUCKETS = 6;

const SPAN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface RangeSpec {
  days: number;
  id: string;
  previous: string;
}

const DEFAULT_RANGE: RangeSpec = {
  days: 30,
  id: "30d",
  previous: "previous 30 days",
};

const RANGE_SPECS: RangeSpec[] = [
  DEFAULT_RANGE,
  { days: 7, id: "7d", previous: "previous 7 days" },
  { days: 90, id: "90d", previous: "previous 90 days" },
];

function windowStart(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function rangeFor(spec: RangeSpec): ManagerRange {
  const from = windowStart(spec.days);

  return {
    id: spec.id,
    label: `${SPAN.format(from)} – ${DAY.format(new Date())}`,
    previous: spec.previous,
  };
}

/**
 * The windows the dropdown offers.
 *
 * Relative rather than named months, because a fixed "August 2026" is wrong
 * the moment the clock passes it, and a control that reports the wrong window
 * is worse than one that offers fewer.
 */
export const MANAGER_RANGES: ManagerRange[] = RANGE_SPECS.map(rangeFor);

function specFor(rangeId?: string): RangeSpec {
  return RANGE_SPECS.find((spec) => spec.id === rangeId) ?? DEFAULT_RANGE;
}

/** Product summaries for a set of ids, keyed for the blocks that need them. */
async function summariesFor(
  merchantId: string,
  ids: string[]
): Promise<Map<string, ProductSummary>> {
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.merchantId, merchantId), inArray(products.id, ids)));

  return new Map(rows.map((row) => [row.product.id, toSummary(row)]));
}

/** Units of each product sold per bucket, oldest bucket first. */
async function trendsFor(
  merchantId: string,
  productIds: string[],
  days: number
): Promise<Map<string, number[]>> {
  const trends = new Map<string, number[]>();

  if (productIds.length === 0) {
    return trends;
  }

  const from = windowStart(days);
  const bucketMs = (days * DAY_MS) / TREND_BUCKETS;

  const rows = await db
    .select({
      at: orders.createdAt,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.orderStatus, "paid"),
        gte(orders.createdAt, from),
        inArray(orderItems.productId, productIds)
      )
    );

  for (const id of productIds) {
    trends.set(id, new Array(TREND_BUCKETS).fill(0));
  }

  for (const row of rows) {
    const offset = row.at.getTime() - from.getTime();
    const bucket = Math.min(
      TREND_BUCKETS - 1,
      Math.max(0, Math.floor(offset / bucketMs))
    );
    const series = trends.get(row.productId);

    if (series) {
      series[bucket] = (series[bucket] ?? 0) + row.quantity;
    }
  }

  return trends;
}

/** How many carts each product has ever sat in. The nearest thing to interest. */
async function cartAppearances(
  merchantId: string,
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      productId: cartItems.productId,
      total: sql<number>`count(distinct ${cartItems.cartId})`,
    })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(
      and(
        eq(carts.merchantId, merchantId),
        inArray(cartItems.productId, productIds)
      )
    )
    .groupBy(cartItems.productId);

  return new Map(rows.map((row) => [row.productId, Number(row.total)]));
}

async function revenueBetween(
  merchantId: string,
  from: Date,
  to: Date
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${orders.totalAmount}), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.orderStatus, "paid"),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to)
      )
    );

  return Number(row?.value ?? 0);
}

const PERCENT = 100;

export async function getManagerSummary(
  rangeId?: string
): Promise<ManagerSummary> {
  const merchantId = await storeId();
  const spec = specFor(rangeId);
  const now = new Date();
  const from = windowStart(spec.days);
  const previousFrom = new Date(from.getTime() - spec.days * DAY_MS);

  const [sales, performance, previousRevenue, newOrders, dueOrders] =
    await Promise.all([
      getSalesSummary(merchantId, spec.days),
      getProductPerformance(merchantId, spec.days),
      revenueBetween(merchantId, previousFrom, from),
      countOrders(merchantId, from, now),
      countDueOrders(merchantId),
    ]);

  const selling = performance.filter((row) => row.unitsSold > 0).slice(0, 3);

  /* Stock still on the shelf and nothing sold in the window — the block that
     used to guess at views asks this instead, which the database knows. */
  const stalled = performance
    .filter((row) => row.stock > 0 && row.unitsSold === 0)
    .slice(0, 3);

  const neverOrdered = await listNeverOrdered(merchantId, 3);

  const ids = [
    ...new Set([
      ...selling.map((row) => row.productId),
      ...stalled.map((row) => row.productId),
      ...neverOrdered.map((row) => row.productId),
    ]),
  ];

  const [summaries, trends, carted, findings] = await Promise.all([
    summariesFor(merchantId, ids),
    trendsFor(
      merchantId,
      selling.map((row) => row.productId),
      spec.days
    ),
    cartAppearances(
      merchantId,
      stalled.map((row) => row.productId)
    ),
    buildFindings(merchantId, spec),
  ]);

  const sellingWell: SellingRow[] = selling
    .map((row) => ({
      product: summaries.get(row.productId),
      trend: trends.get(row.productId) ?? [],
      units: row.unitsSold,
    }))
    .filter((row): row is SellingRow => row.product !== undefined);

  const seenNotBought: SeenNotBoughtRow[] = stalled
    .map((row) => ({
      carted: carted.get(row.productId) ?? 0,
      product: summaries.get(row.productId),
      sold: row.unitsSold,
    }))
    .filter((row): row is SeenNotBoughtRow => row.product !== undefined);

  const neverSeen: NeverSeenRow[] = neverOrdered
    .map((row) => ({
      listedDaysAgo: row.listedDaysAgo,
      product: summaries.get(row.productId),
    }))
    .filter((row): row is NeverSeenRow => row.product !== undefined);

  return {
    dueOrders,
    earningsDeltaPercent:
      previousRevenue === 0
        ? 0
        : Number(
            (
              ((sales.revenuePaise - previousRevenue) / previousRevenue) *
              PERCENT
            ).toFixed(1)
          ),
    earningsPaise: sales.revenuePaise,
    findings,
    neverSeen,
    newOrders,
    range: rangeFor(spec),
    seenNotBought,
    sellingWell,
  };
}

async function countOrders(merchantId: string, from: Date, to: Date) {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        gte(orders.createdAt, from),
        lt(orders.createdAt, to)
      )
    );

  return Number(row?.value ?? 0);
}

/** Orders the merchant still owes something on: unapproved, or paid-not-sent. */
async function countDueOrders(merchantId: string) {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        sql`(${orders.approvalStatus} = 'pending_approval' or ${orders.orderStatus} = 'paid')`
      )
    );

  return Number(row?.value ?? 0);
}

async function listNeverOrdered(merchantId: string, limit: number) {
  const rows = await db
    .select({ createdAt: products.createdAt, productId: products.id })
    .from(products)
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.isActive, true),
        sql`${orderItems.id} is null`
      )
    )
    .orderBy(products.createdAt)
    .limit(limit);

  return rows.map((row) => ({
    listedDaysAgo: Math.max(
      0,
      Math.floor((Date.now() - row.createdAt.getTime()) / DAY_MS)
    ),
    productId: row.productId,
  }));
}

/* ── Findings ───────────────────────────────────────────────────────────── */

const HIGH_COVER_DAYS = 14;

/**
 * The briefing.
 *
 * Every line here is derived from a number this database holds, and every
 * line carries the evidence it was derived from — a finding a merchant cannot
 * check is one they will learn to scroll past. An empty list is a real
 * answer: a quiet week has nothing worth acting on, and saying so is more
 * useful than manufacturing a third thing to worry about.
 */
async function buildFindings(
  merchantId: string,
  spec: RangeSpec
): Promise<Finding[]> {
  const [risks, performance, lowStock] = await Promise.all([
    getStockRisk(merchantId, spec.days),
    getProductPerformance(merchantId, spec.days),
    getLowStockProducts(merchantId),
  ]);

  const findings: Finding[] = [];
  const window = `Last ${spec.days} days`;

  const runningOut = risks
    .filter((risk) => risk.stocksOutBeforeResupply)
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0))
    .slice(0, 2);

  for (const risk of runningOut) {
    const reorder = lowStock.find(
      (row) => row.productId === risk.productId
    )?.reorderQuantity;

    findings.push({
      action: reorder
        ? `Reorder ${reorder} units — the supplier takes ${risk.leadTimeDays} days.`
        : `Raise a reorder now — the supplier takes ${risk.leadTimeDays} days.`,
      evidence: [
        { label: "Sold", value: `${risk.unitsSold} units` },
        { label: "On hand", value: `${risk.stock} units` },
        { label: "Cover", value: `${risk.daysOfCover} days` },
        { label: "Lead time", value: `${risk.leadTimeDays} days` },
      ],
      headline: `${risk.name} runs out in ${risk.daysOfCover} days, before a reorder could arrive.`,
      id: `stock-${risk.productId}`,
      proposedAction: { kind: "reorder", label: "Draft a reorder" },
      urgency: "high",
      window,
    });
  }

  const tiedUp = performance
    .filter((row) => row.unitsSold === 0 && row.stock > 0)
    .sort((a, b) => b.stock * b.pricePaise - a.stock * a.pricePaise)
    .slice(0, 2);

  for (const row of tiedUp) {
    findings.push({
      action: "Discount it, or give it a row on its category page.",
      evidence: [
        { label: "Sold", value: "0 units" },
        { label: "On hand", value: `${row.stock} units` },
        {
          label: "Tied up",
          value: formatPaise(row.stock * row.pricePaise),
        },
      ],
      headline: `${row.name} has not sold a unit in ${spec.days} days.`,
      id: `stalled-${row.productId}`,
      proposedAction: { kind: "discount", label: "Propose a discount" },
      urgency: "medium",
      window,
    });
  }

  const overstocked = risks
    .filter(
      (risk) =>
        risk.daysOfCover !== null && risk.daysOfCover > HIGH_COVER_DAYS * 10
    )
    .slice(0, 1);

  for (const risk of overstocked) {
    findings.push({
      action: "Nothing to do — it is covered for months.",
      evidence: [
        { label: "On hand", value: `${risk.stock} units` },
        { label: "Cover", value: `${risk.daysOfCover} days` },
        { label: "Velocity", value: `${risk.dailyVelocity}/day` },
      ],
      headline: `${risk.name} is stocked well past its rate of sale.`,
      id: `cover-${risk.productId}`,
      proposedAction: { kind: "dismiss", label: "Not worth acting on" },
      urgency: "low",
      window,
    });
  }

  return findings;
}

/* ── The editing surfaces ───────────────────────────────────────────────── */

const DEFAULT_LOW_AT = 5;

export const getManagerProducts = cache(async (): Promise<ManagerProduct[]> => {
  const merchantId = await storeId();

  const rows = await db
    .select({
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      specs: productSpecs,
    })
    .from(products)
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(products.merchantId, merchantId))
    .orderBy(products.category, products.name);

  return rows.map((row) => ({
    lowAt: row.lowStockThreshold ?? DEFAULT_LOW_AT,
    product: toSummary(row),
    /* `is_active` is the flag the storefront filters on, so it is the one
         thing "live" can honestly mean here. */
    status: row.product.isActive ? "live" : "draft",
    stock: row.product.stock,
  }));
});

/**
 * The order's state as the operator acts on it.
 *
 * `fulfilled` is not derived from anything — there is no shipment record —
 * so a paid order stays `due` until something in the system says otherwise.
 * A column that promises fulfilment the warehouse never confirmed is how an
 * operator stops trusting the column.
 */
function orderState(order: {
  approvalStatus: string;
  orderStatus: string;
}): ManagerOrderState {
  if (order.orderStatus === "cancelled" || order.orderStatus === "failed") {
    return "cancelled";
  }

  if (order.approvalStatus === "pending_approval") {
    return "new";
  }

  return order.orderStatus === "paid" ? "due" : "new";
}

export const getManagerOrders = cache(async (): Promise<ManagerOrder[]> => {
  const merchantId = await storeId();

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.merchantId, merchantId))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  if (rows.length === 0) {
    return [];
  }

  const lines = await db
    .select({
      name: products.name,
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
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
      customer: order.buyerIdentifier,
      id: orderRef(order.id),
      itemCount: own.reduce((sum, line) => sum + line.quantity, 0),
      lines: own.map((line) => ({
        name: line.name ?? "Item",
        pricePaise: line.unitPrice,
        quantity: line.quantity,
      })),
      placedOn: DAY.format(order.createdAt),
      state: orderState(order),
      totalPaise: order.totalAmount,
    };
  });
});

const DEFAULT_REORDER = 10;

export const getRestock = cache(
  async (): Promise<{ drafts: RestockDraft[]; rows: RestockRow[] }> => {
    const merchantId = await storeId();

    const [low, draftRows] = await Promise.all([
      getLowStockProducts(merchantId),
      db
        .select()
        .from(reorderRequests)
        .where(
          and(
            eq(reorderRequests.merchantId, merchantId),
            eq(reorderRequests.status, "draft")
          )
        )
        .orderBy(desc(reorderRequests.createdAt)),
    ]);

    const ids = [
      ...new Set([
        ...low.map((row) => row.productId),
        ...draftRows.map((row) => row.productId),
      ]),
    ];

    const summaries = await summariesFor(merchantId, ids);

    const rows: RestockRow[] = low
      .map((row) => {
        const product = summaries.get(row.productId);

        if (!product) {
          return null;
        }

        return {
          id: row.productId,
          inStock: row.stock,
          product,
          suggested: row.reorderQuantity ?? DEFAULT_REORDER,
          threshold: row.reorderPoint ?? row.lowStockThreshold ?? 0,
        };
      })
      .filter((row): row is RestockRow => row !== null);

    const drafts: RestockDraft[] = draftRows
      .map((row) => {
        const product = summaries.get(row.productId);

        if (!product) {
          return null;
        }

        return {
          id: row.id,
          product,
          provenance: row.createdByAgent
            ? `Drafted by the assistant: ${row.reason}`
            : row.reason,
          quantity: row.quantity,
        };
      })
      .filter((row): row is RestockDraft => row !== null);

    return { drafts, rows };
  }
);

/** The first eight and the last four of a key. The secret never leaves the row. */
function maskKey(keyId: string): string {
  return `${keyId.slice(0, 8)}${"•".repeat(8)}${keyId.slice(-4)}`;
}

/**
 * Test or live, from the key id itself.
 *
 * Razorpay stamps the mode into the prefix, so there is nothing to store and
 * nothing to get out of sync — and an operator looking at this screen can tell
 * at a glance whether the store is taking real money.
 */
function keyMode(keyId: string | null | undefined): "live" | "test" | null {
  if (!keyId) {
    return null;
  }

  if (keyId.startsWith("rzp_test_")) {
    return "test";
  }

  return keyId.startsWith("rzp_live_") ? "live" : null;
}

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const merchant = await requireDefaultStore();

  const [owner, viewer] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, merchant.userId) }),
    currentUser(),
  ]);

  /* Read rather than required: the platform keys are optional in development,
     and a settings screen should not be the thing that 500s over a missing
     env var. */
  const platformKeyId = process.env.RAZORPAY_KEY_ID ?? null;
  const connected = Boolean(merchant.razorpayKeyId);

  return {
    currency: merchant.currency,
    isOwner: viewer?.id === merchant.userId,
    merchantId: merchant.id,
    name: merchant.businessName,
    ownerEmail: owner?.email ?? null,
    razorpay: {
      connected,
      keyId: merchant.razorpayKeyId ? maskKey(merchant.razorpayKeyId) : null,
      mode: keyMode(merchant.razorpayKeyId),
      platformMode: keyMode(platformKeyId),
    },
    slug: merchant.storeSlug,
    /* One merchant, one user. There is no team table, so the team is the one
       person the store actually belongs to rather than three invented ones. */
    team: owner
      ? [
          {
            email: owner.email,
            id: owner.id,
            name: owner.name,
            role: "Owner" as const,
          },
        ]
      : [],
  };
});
