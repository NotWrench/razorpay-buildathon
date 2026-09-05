import { db, orderItems, orders, products } from "@workspace/db";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { formatPaise } from "./money";

/**
 * Margin: what the shop actually kept.
 *
 * Revenue is the number this system optimised for until now, and revenue is a
 * number a discount can always improve. "Grew revenue 18%" and "gave away 30%
 * on the products that moved" are the same week described two ways, and only
 * one of them is a business getting better.
 *
 * Every function here reports its own coverage. `cost_price` is nullable by
 * design — a product with no cost has not been configured, which is a
 * different fact from one that costs nothing — so a gross margin computed over
 * the priced half of a catalogue and presented as the whole would be worse
 * than no figure at all. The uncosted revenue comes back alongside the
 * percentage, every time, and the agent is told to say it out loud.
 */

const PAID_STATUSES = ["paid"] as const;
const PERCENT = 100;

function since(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

export interface MarginSummary {
  /** Stated so the merchant can disagree with the basis, not just the number. */
  assumptions: string;
  costOfGoodsPaise: number;
  grossMarginPaise: number;
  /** Over the costed portion only. Null when nothing costed sold. */
  grossMarginPercent: number | null;
  /** Products in the catalogue with no cost recorded. */
  productsWithoutCost: number;
  revenuePaise: number;
  /** Revenue this window from products with no cost. Excluded from the margin. */
  uncostedRevenuePaise: number;
  windowDays: number;
}

/**
 * Revenue, cost of goods and gross margin over a window.
 *
 * Cost is taken from the product's current `cost_price` rather than from a
 * cost captured on the order line, because there is no such column. That is a
 * real limitation and it is named in `assumptions`: a supplier price that has
 * moved since restates history. Recording cost on `order_items` at checkout is
 * the fix, and it is a different change from this one.
 */
export async function getMarginSummary(
  merchantId: string,
  windowDays = 30
): Promise<MarginSummary> {
  const from = since(windowDays);

  const lines = await db
    .select({
      costPrice: products.costPrice,
      quantity: orderItems.quantity,
      subtotal: orderItems.subtotal,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, PAID_STATUSES),
        gte(orders.createdAt, from)
      )
    );

  const uncosted = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        eq(products.isActive, true),
        isNull(products.costPrice)
      )
    );

  let revenuePaise = 0;
  let costOfGoodsPaise = 0;
  let costedRevenuePaise = 0;
  let uncostedRevenuePaise = 0;

  for (const line of lines) {
    revenuePaise += line.subtotal;

    if (line.costPrice === null) {
      uncostedRevenuePaise += line.subtotal;
      continue;
    }

    costedRevenuePaise += line.subtotal;
    costOfGoodsPaise += line.costPrice * line.quantity;
  }

  const grossMarginPaise = costedRevenuePaise - costOfGoodsPaise;

  return {
    assumptions:
      `Measured over the last ${windowDays} days of paid orders. Cost is each product's ` +
      "cost price as it stands today, not as it stood when the order was placed, so a supplier " +
      "price that has moved since restates history. " +
      (uncostedRevenuePaise > 0
        ? `${formatPaise(uncostedRevenuePaise)} of this window's revenue came from products with no cost recorded and is excluded from the margin entirely.`
        : "Every product sold in this window has a cost recorded."),
    costOfGoodsPaise,
    grossMarginPaise,
    grossMarginPercent:
      costedRevenuePaise > 0
        ? Number(
            ((grossMarginPaise / costedRevenuePaise) * PERCENT).toFixed(1)
          )
        : null,
    productsWithoutCost: uncosted.length,
    revenuePaise,
    uncostedRevenuePaise,
    windowDays,
  };
}

export interface ProductMargin {
  costPricePaise: number | null;
  marginPaise: number | null;
  marginPercent: number | null;
  name: string;
  pricePaise: number;
  productId: string;
}

/** Per-unit margin for one product, or nulls when no cost is recorded. */
export async function getProductMargin(
  merchantId: string,
  productId: string
): Promise<ProductMargin | null> {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.merchantId, merchantId)),
  });

  if (!product) {
    return null;
  }

  return describeMargin(product);
}

/** Shared so the floor and the reporting cannot drift apart on the arithmetic. */
export function describeMargin(product: {
  costPrice: number | null;
  id: string;
  name: string;
  price: number;
}): ProductMargin {
  if (product.costPrice === null) {
    return {
      costPricePaise: null,
      marginPaise: null,
      marginPercent: null,
      name: product.name,
      pricePaise: product.price,
      productId: product.id,
    };
  }

  const marginPaise = product.price - product.costPrice;

  return {
    costPricePaise: product.costPrice,
    marginPaise,
    marginPercent:
      product.price > 0
        ? Number(((marginPaise / product.price) * PERCENT).toFixed(1))
        : null,
    name: product.name,
    pricePaise: product.price,
    productId: product.id,
  };
}
