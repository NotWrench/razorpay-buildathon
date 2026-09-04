import { getBuildOrThrow } from "@workspace/commerce/builds";
import { getCartByIdOrThrow } from "@workspace/commerce/carts";
import { db, orders, products } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { AgentContext } from "./context";
import { formatPaise } from "./money";

/**
 * Where the buyer is when they ask.
 *
 * §7 wants the assistant to know the page it was opened from, so "is this one
 * any good?" has a referent. The ids arrive from the client, which makes this
 * the one place in the agent layer that handles model- and client-supplied
 * identifiers — and so the rule here is absolute: **nothing is trusted, every
 * id is re-read from the database under the buyer's own scope, and anything
 * that does not resolve is dropped**.
 *
 * Dropped, not rejected. An order id belonging to someone else must produce a
 * turn that simply does not mention an order — telling the caller "that order
 * is not yours" confirms it exists, which is a disclosure in itself. The buyer
 * whose own page it is loses nothing; anybody probing learns nothing.
 */

export const CONTEXT_PAGES = [
  "home",
  "product",
  "search",
  "build",
  "cart",
  "order",
] as const;

export type ContextPage = (typeof CONTEXT_PAGES)[number];

export interface PageContextInput {
  buildId?: string;
  cartId?: string;
  orderId?: string;
  page: ContextPage;
  productId?: string;
  searchQuery?: string;
}

export interface ResolvedPageContext {
  /** A line for the prompt, naming only what actually resolved. */
  description: string;
  page: ContextPage;
  /** Ids that resolved under this buyer's scope, safe to pass to a tool. */
  resolved: {
    buildId?: string;
    cartId?: string;
    orderId?: string;
    productId?: string;
  };
}

async function describeProduct(
  ctx: AgentContext,
  productId: string
): Promise<string | null> {
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.merchantId, ctx.merchantId)
    ),
  });

  if (!product) {
    return null;
  }

  return `viewing ${product.name} (${formatPaise(product.price)}, ${product.stock > 0 ? `${product.stock} in stock` : "out of stock"}), product id ${product.id}`;
}

async function describeOrder(
  ctx: AgentContext,
  orderId: string
): Promise<string | null> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.merchantId, ctx.merchantId),
      // The ownership check §20 asks for, and the reason this is resolved on
      // the server rather than trusted from the body.
      eq(orders.buyerIdentifier, ctx.actor.identifier)
    ),
  });

  if (!order) {
    return null;
  }

  return `looking at their order ${order.id} — ${order.orderStatus}, ${order.approvalStatus}, ${formatPaise(order.totalAmount)}`;
}

async function describeBuild(
  ctx: AgentContext,
  buildId: string
): Promise<string | null> {
  try {
    const build = await getBuildOrThrow({
      buildId,
      buyerIdentifier: ctx.actor.identifier,
      merchantId: ctx.merchantId,
    });

    return `working on their build "${build.name}" (${build.items.length} parts, ${build.status}), build id ${build.id}`;
  } catch {
    return null;
  }
}

async function describeCart(
  ctx: AgentContext,
  cartId: string
): Promise<string | null> {
  try {
    const cart = await getCartByIdOrThrow({
      buyerIdentifier: ctx.actor.identifier,
      cartId,
      merchantId: ctx.merchantId,
    });

    return `viewing their cart (${cart.items.length} lines), cart id ${cart.id}`;
  } catch {
    return null;
  }
}

/**
 * Turns a client-supplied page context into something the prompt can state.
 *
 * Every branch re-reads the row scoped to this merchant and this buyer. A
 * caller could post any uuid it likes; only the ones that come back are
 * mentioned, and only those reach `resolved` for a tool to use.
 */
export async function resolvePageContext(
  ctx: AgentContext,
  input: PageContextInput | undefined
): Promise<ResolvedPageContext | null> {
  if (!input) {
    return null;
  }

  const parts: string[] = [];
  const resolved: ResolvedPageContext["resolved"] = {};

  if (input.productId) {
    const described = await describeProduct(ctx, input.productId);

    if (described) {
      parts.push(described);
      resolved.productId = input.productId;
    }
  }

  if (input.orderId) {
    const described = await describeOrder(ctx, input.orderId);

    if (described) {
      parts.push(described);
      resolved.orderId = input.orderId;
    }
  }

  if (input.buildId) {
    const described = await describeBuild(ctx, input.buildId);

    if (described) {
      parts.push(described);
      resolved.buildId = input.buildId;
    }
  }

  if (input.cartId) {
    const described = await describeCart(ctx, input.cartId);

    if (described) {
      parts.push(described);
      resolved.cartId = input.cartId;
    }
  }

  if (input.searchQuery) {
    // Free text, and the only field with nothing to verify — so it is quoted
    // as the buyer's words rather than restated as fact.
    parts.push(`they searched for "${input.searchQuery.slice(0, 200)}"`);
  }

  if (parts.length === 0) {
    return {
      description: `The buyer is on the ${input.page} page.`,
      page: input.page,
      resolved,
    };
  }

  return {
    description: `The buyer is on the ${input.page} page: ${parts.join("; ")}. When they say "this" or "it", they most likely mean that.`,
    page: input.page,
    resolved,
  };
}

/**
 * The window the merchant is looking at.
 *
 * Deliberately far simpler than the buyer's context above, and for the same
 * reason it is safe: it carries no identifiers at all. The merchant's screen
 * is a briefing over a window, so the only thing worth telling the agent is
 * which window — everything else on that screen came from the same tools the
 * agent can call for itself, and re-deriving a figure is cheaper than trusting
 * one the client posted.
 */
export interface MerchantView {
  /** The range selected on `/manager`, in days. */
  rangeDays: number;
}

/** Windows the manager screen offers. Anything else is not a real view. */
const MERCHANT_RANGE_DAYS = [7, 30, 90] as const;

export function describeMerchantView(
  view: MerchantView | undefined
): string | null {
  if (!view) {
    return null;
  }

  const days = MERCHANT_RANGE_DAYS.find((value) => value === view.rangeDays);

  if (!days) {
    return null;
  }

  return (
    `The merchant is reading the last ${days} days on their briefing screen. ` +
    `Use windowDays: ${days} unless they name a different period, so your ` +
    "numbers match the ones already in front of them."
  );
}
