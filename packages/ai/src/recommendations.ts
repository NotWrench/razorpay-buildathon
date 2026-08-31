import { db, inventory, orderItems, orders, products } from "@workspace/db";
import { and, eq, gte, inArray, sum } from "drizzle-orm";
import { getProductPerformance } from "./analytics";

/**
 * What the merchant agent should suggest doing, and why.
 *
 * §11 is emphatic that these are recommendations. Nothing here writes
 * anything, and `getDiscontinueCandidates` has no matching mutation anywhere
 * in the codebase on purpose — discontinuing a product is a decision with
 * supplier contracts and customer expectations behind it that this system
 * cannot see.
 *
 * §10 asks for the assumptions to be surfaced, so every result carries the
 * window it was measured over and the rule that selected it. A merchant who
 * disagrees with a suggestion should be able to see exactly which number
 * produced it.
 */

const PAID_STATUSES = ["paid"] as const;

/** Cover below this, in days, and a reorder is worth raising. */
const REORDER_COVER_DAYS = 30;

/** Above this many days of stock at the current rate, a product is stagnant. */
const EXCESS_COVER_DAYS = 180;

/** A product must have been on sale this long before absence of sales means anything. */
const MIN_AGE_DAYS = 30;

function since(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

interface VelocityRow {
  createdAt: Date;
  leadTimeDays: number | null;
  name: string;
  price: number;
  productId: string;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  sku: string | null;
  stock: number;
  unitsSold: number;
}

async function velocities(
  merchantId: string,
  windowDays: number
): Promise<VelocityRow[]> {
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
      createdAt: products.createdAt,
      leadTimeDays: inventory.supplierLeadTimeDays,
      name: products.name,
      price: products.price,
      productId: products.id,
      reorderPoint: inventory.reorderPoint,
      reorderQuantity: inventory.reorderQuantity,
      sku: products.sku,
      stock: products.stock,
      units: sold.units,
    })
    .from(products)
    .leftJoin(sold, eq(sold.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      and(eq(products.merchantId, merchantId), eq(products.isActive, true))
    );

  return rows.map((row) => ({
    createdAt: row.createdAt,
    leadTimeDays: row.leadTimeDays,
    name: row.name,
    price: row.price,
    productId: row.productId,
    reorderPoint: row.reorderPoint,
    reorderQuantity: row.reorderQuantity,
    sku: row.sku,
    stock: row.stock,
    unitsSold: Number(row.units ?? 0),
  }));
}

export interface ReorderCandidate {
  dailyVelocity: number;
  daysOfCover: number;
  leadTimeDays: number | null;
  name: string;
  productId: string;
  /** Why this product, in the merchant's terms. */
  rationale: string;
  sku: string | null;
  stock: number;
  /** Enough to reach the cover target, or the configured quantity if larger. */
  suggestedQuantity: number;
  unitsSold: number;
}

export interface WindowedResult<T> {
  /** Stated so the merchant can disagree with the basis, not just the number. */
  assumptions: string;
  candidates: T[];
  windowDays: number;
}

/**
 * Products worth reordering, with the quantity worked out rather than guessed.
 *
 * The suggested quantity buys back to thirty days of cover at the measured
 * rate, or the merchant's own configured reorder quantity where that is
 * larger — their number wins, because they may know about a supplier minimum
 * this system cannot see.
 */
export async function getReorderCandidates(
  merchantId: string,
  windowDays = 30,
  limit = 15
): Promise<WindowedResult<ReorderCandidate>> {
  const rows = await velocities(merchantId, windowDays);

  const candidates = rows
    .flatMap((row) => {
      const dailyVelocity = row.unitsSold / windowDays;

      // Nothing sold means no basis for a reorder. That is a different
      // finding, and getDiscountCandidates is where it belongs.
      if (dailyVelocity <= 0) {
        return [];
      }

      const daysOfCover = Math.round(row.stock / dailyVelocity);
      const shortOnCover = daysOfCover <= REORDER_COVER_DAYS;
      const beatsLeadTime =
        row.leadTimeDays !== null && daysOfCover < row.leadTimeDays;
      const belowReorderPoint =
        row.reorderPoint !== null && row.stock <= row.reorderPoint;

      if (!(shortOnCover || beatsLeadTime || belowReorderPoint)) {
        return [];
      }

      const toTarget = Math.max(
        0,
        Math.ceil(dailyVelocity * REORDER_COVER_DAYS) - row.stock
      );

      const reasons: string[] = [];

      if (belowReorderPoint) {
        reasons.push(`at or below its reorder point of ${row.reorderPoint}`);
      }

      if (beatsLeadTime) {
        reasons.push(
          `${daysOfCover} days of cover against a ${row.leadTimeDays}-day lead time, so it empties before a replacement lands`
        );
      } else if (shortOnCover) {
        reasons.push(`${daysOfCover} days of cover at the current rate`);
      }

      return [
        {
          dailyVelocity: Number(dailyVelocity.toFixed(3)),
          daysOfCover,
          leadTimeDays: row.leadTimeDays,
          name: row.name,
          productId: row.productId,
          rationale: `${row.stock} on hand, ${row.unitsSold} sold in ${windowDays} days — ${reasons.join("; ")}.`,
          sku: row.sku,
          stock: row.stock,
          suggestedQuantity: Math.max(toTarget, row.reorderQuantity ?? 0),
          unitsSold: row.unitsSold,
        },
      ];
    })
    .sort((a, b) => a.daysOfCover - b.daysOfCover)
    .slice(0, limit);

  return {
    assumptions: `Velocity is units sold in paid orders over the last ${windowDays} days, projected forward flat. Suggested quantities buy back to ${REORDER_COVER_DAYS} days of cover, or the configured reorder quantity where that is larger. Seasonality and any campaign that has since ended are not accounted for.`,
    candidates,
    windowDays,
  };
}

export interface DiscountCandidate {
  daysOfCover: number | null;
  name: string;
  productId: string;
  rationale: string;
  sku: string | null;
  stock: number;
  /** Capital sitting on the shelf, in paise. */
  stockValuePaise: number;
  unitsSold: number;
}

/**
 * Stock that is not moving: weak velocity against real quantity on hand.
 *
 * Value on hand is reported because it is what makes the case. "Fourteen units
 * unsold" is a shrug; "₹42,000 of shelf tied up in something that sold twice
 * in a month" is a decision.
 */
export async function getDiscountCandidates(
  merchantId: string,
  windowDays = 30,
  limit = 15
): Promise<WindowedResult<DiscountCandidate>> {
  const rows = await velocities(merchantId, windowDays);
  const now = new Date();

  const candidates = rows
    .flatMap((row) => {
      // A product listed last week has not had a chance to sell.
      if (daysBetween(row.createdAt, now) < MIN_AGE_DAYS || row.stock <= 0) {
        return [];
      }

      const dailyVelocity = row.unitsSold / windowDays;
      const daysOfCover =
        dailyVelocity > 0 ? Math.round(row.stock / dailyVelocity) : null;

      if (daysOfCover !== null && daysOfCover < EXCESS_COVER_DAYS) {
        return [];
      }

      return [
        {
          daysOfCover,
          name: row.name,
          productId: row.productId,
          rationale:
            daysOfCover === null
              ? `${row.stock} on hand and nothing sold in ${windowDays} days.`
              : `${row.stock} on hand against ${row.unitsSold} sold in ${windowDays} days — about ${daysOfCover} days of stock at that rate.`,
          sku: row.sku,
          stock: row.stock,
          stockValuePaise: row.stock * row.price,
          unitsSold: row.unitsSold,
        },
      ];
    })
    .sort((a, b) => b.stockValuePaise - a.stockValuePaise)
    .slice(0, limit);

  return {
    assumptions: `Measured over the last ${windowDays} days of paid orders. A product is listed when it holds stock and has either sold nothing or has over ${EXCESS_COVER_DAYS} days of cover. Products listed less than ${MIN_AGE_DAYS} days ago are excluded, because they have not had a fair run.`,
    candidates,
    windowDays,
  };
}

export interface DiscontinueCandidate {
  name: string;
  productId: string;
  rationale: string;
  /** Revenue over the whole window, in paise. */
  revenuePaise: number;
  sku: string | null;
  stock: number;
  stockValuePaise: number;
  unitsSold: number;
}

/**
 * Products that have not earned their shelf space over a long window.
 *
 * §11 is explicit that this is a recommendation and never an automatic
 * deletion, so there is deliberately no `discontinueProduct` mutation for the
 * agent to reach for. Ninety days is the default window because a month of
 * poor sales is noise and a quarter is a pattern.
 */
export async function getDiscontinueCandidates(
  merchantId: string,
  windowDays = 90,
  limit = 10
): Promise<WindowedResult<DiscontinueCandidate>> {
  const [rows, performance] = await Promise.all([
    velocities(merchantId, windowDays),
    getProductPerformance(merchantId, windowDays),
  ]);

  const revenueById = new Map(
    performance.map((row) => [row.productId, row.revenuePaise])
  );
  const now = new Date();

  const candidates = rows
    .flatMap((row) => {
      if (daysBetween(row.createdAt, now) < windowDays || row.unitsSold > 1) {
        return [];
      }

      return [
        {
          name: row.name,
          productId: row.productId,
          rationale: `${row.unitsSold === 0 ? "Nothing" : "One unit"} sold in ${windowDays} days, with ${row.stock} still on hand.`,
          revenuePaise: revenueById.get(row.productId) ?? 0,
          sku: row.sku,
          stock: row.stock,
          stockValuePaise: row.stock * row.price,
          unitsSold: row.unitsSold,
        },
      ];
    })
    .sort((a, b) => b.stockValuePaise - a.stockValuePaise)
    .slice(0, limit);

  return {
    assumptions: `Measured over the last ${windowDays} days of paid orders. Only products that have been listed for the whole window are considered, and only those that sold at most one unit. This is a recommendation to review, not to delete — there is no tool here that removes a product, and there should not be.`,
    candidates,
    windowDays,
  };
}
