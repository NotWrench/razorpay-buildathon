import {
  agentDb,
  buildItems,
  builds,
  conversations,
  db,
  orderItems,
  orders,
  products,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { currentBuyer } from "@/lib/store/buyer";
import { storeId } from "./store";
import type { Account, AccountOrder, OrderState, SavedBuild } from "./types";

/**
 * The signed-in shopper's own page.
 *
 * Scoped by `buyer_identifier` — the same key the order tools and the money
 * path filter on — so a guest sees the guest's basket and orders, and never
 * anybody else's. A guest is a real state here rather than a redirect: the
 * storefront is deliberately usable without an account, and someone who has
 * placed an order as a guest should be able to find it again.
 */

/**
 * `orders.order_status` is about money; the shopper's word is about parcels.
 *
 * There is no fulfilment table yet, so nothing here claims a parcel moved: a
 * paid order reads as `processing` until something in the system actually
 * knows it shipped. Inventing "delivered" from a payment timestamp would be
 * the page telling the shopper something no part of the platform believes.
 */
const ORDER_STATE: Record<string, OrderState> = {
  cancelled: "cancelled",
  created: "processing",
  draft: "processing",
  failed: "cancelled",
  paid: "processing",
};

const MONTH = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "NX-4821" — short, mono, and stable for one order. */
export function orderRef(id: string): string {
  return `NX-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export const getAccount = cache(async (): Promise<Account> => {
  const merchantId = await storeId();
  const buyer = await currentBuyer();
  const scope = and(
    eq(orders.merchantId, merchantId),
    eq(orders.buyerIdentifier, buyer.identifier)
  );

  const [orderRows, buildRows, conversationCount] = await Promise.all([
    db.select().from(orders).where(scope).orderBy(desc(orders.createdAt)),
    db
      .select({
        id: builds.id,
        name: builds.name,
        updatedAt: builds.updatedAt,
      })
      .from(builds)
      .where(
        and(
          eq(builds.merchantId, merchantId),
          eq(builds.buyerIdentifier, buyer.identifier)
        )
      )
      .orderBy(desc(builds.updatedAt)),
    countConversations(merchantId, buyer.identifier),
  ]);

  const [lines, buildTotals] = await Promise.all([
    linesFor(orderRows.map((order) => order.id)),
    totalsFor(buildRows.map((build) => build.id)),
  ]);

  const accountOrders: AccountOrder[] = orderRows.map((order) => {
    const own = lines.get(order.id) ?? [];

    return {
      id: orderRef(order.id),
      itemCount: own.reduce((sum, line) => sum + line.quantity, 0),
      lines: own,
      placedOn: DAY.format(order.createdAt),
      state: ORDER_STATE[order.orderStatus] ?? "processing",
      totalPaise: order.totalAmount,
    };
  });

  const savedBuilds: SavedBuild[] = buildRows.map((build) => ({
    id: build.id,
    name: build.name,
    partCount: buildTotals.get(build.id)?.parts ?? 0,
    totalPaise: buildTotals.get(build.id)?.paise ?? 0,
  }));

  /* Only settled money counts as spent. A draft order the buyer abandoned is
     not a purchase, and adding it would overstate the figure the page leads
     with. */
  const totalSpentPaise = orderRows
    .filter((order) => order.orderStatus === "paid")
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const since = orderRows.at(-1)?.createdAt ?? new Date();

  return {
    /* No address book exists yet. An empty list renders an empty section,
       which is true; two invented addresses would not be. */
    addresses: [],
    builds: savedBuilds,
    email: buyer.isGuest ? "Guest session" : buyer.identifier,
    figures: {
      builds: savedBuilds.length,
      conversations: conversationCount,
      orders: accountOrders.length,
      totalSpentPaise,
    },
    memberSince: MONTH.format(since),
    name: buyer.name ?? "Guest",
    orders: accountOrders,
  };
});

async function linesFor(orderIds: string[]) {
  const grouped = new Map<
    string,
    { name: string; pricePaise: number; quantity: number }[]
  >();

  if (orderIds.length === 0) {
    return grouped;
  }

  const rows = await db
    .select({
      name: products.name,
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(inArray(orderItems.orderId, orderIds));

  for (const row of rows) {
    const bucket = grouped.get(row.orderId) ?? [];

    bucket.push({
      name: row.name ?? "Item",
      pricePaise: row.unitPrice,
      quantity: row.quantity,
    });
    grouped.set(row.orderId, bucket);
  }

  return grouped;
}

async function totalsFor(buildIds: string[]) {
  const totals = new Map<string, { paise: number; parts: number }>();

  if (buildIds.length === 0) {
    return totals;
  }

  const rows = await db
    .select({
      buildId: buildItems.buildId,
      price: products.price,
      quantity: buildItems.quantity,
    })
    .from(buildItems)
    .innerJoin(products, eq(products.id, buildItems.productId))
    .where(inArray(buildItems.buildId, buildIds));

  for (const row of rows) {
    const current = totals.get(row.buildId) ?? { paise: 0, parts: 0 };

    totals.set(row.buildId, {
      paise: current.paise + row.price * row.quantity,
      parts: current.parts + row.quantity,
    });
  }

  return totals;
}

/**
 * Conversations live in the agent database, which is a separate connection
 * and an optional one. A profile that cannot render because the memory
 * database is down would be the wrong trade for one number.
 */
async function countConversations(
  merchantId: string,
  buyerIdentifier: string
): Promise<number> {
  try {
    const [row] = await agentDb
      .select({ value: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.merchantId, merchantId),
          eq(conversations.buyerIdentifier, buyerIdentifier)
        )
      );

    return Number(row?.value ?? 0);
  } catch {
    return 0;
  }
}
