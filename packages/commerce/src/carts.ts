import { cartItems, carts, db, products } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { BuildError, loadBuildComponents } from "./builds";
import type { BuildValidation } from "./compatibility/index";
import { validateBuild } from "./compatibility/index";

/**
 * Carts, as rows.
 *
 * Same rule as builds: every function takes a `merchantId` and a
 * `buyerIdentifier` from the server-resolved context and filters on both, so
 * a tool cannot reach another shopper's basket however it is called.
 *
 * Nothing here decides a price. `unit_price_paise` is written for display and
 * for spotting that a price moved while the cart sat; what the buyer is
 * charged is re-derived from live product rows at checkout, which stays the
 * single place a price is settled.
 */

export class CartError extends Error {
  readonly code: "CART_NOT_FOUND" | "PRODUCT_NOT_FOUND" | "LINE_NOT_FOUND";

  constructor(
    code: "CART_NOT_FOUND" | "PRODUCT_NOT_FOUND" | "LINE_NOT_FOUND",
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "CartError";
  }
}

export interface CartOwner {
  buyerIdentifier: string;
  conversationId?: string | null;
  merchantId: string;
  userId?: string | null;
}

const MAX_QUANTITY_PER_LINE = 10;

/**
 * The buyer's open cart, creating one if there is none.
 *
 * A partial unique index makes a second open cart impossible, so a race here
 * fails at the database rather than quietly producing two baskets that each
 * look complete.
 */
export async function getOrCreateOpenCart(owner: CartOwner) {
  const existing = await db.query.carts.findFirst({
    where: and(
      eq(carts.merchantId, owner.merchantId),
      eq(carts.buyerIdentifier, owner.buyerIdentifier),
      eq(carts.status, "open")
    ),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(carts)
    .values({
      buyerIdentifier: owner.buyerIdentifier,
      conversationId: owner.conversationId ?? null,
      merchantId: owner.merchantId,
      userId: owner.userId ?? null,
    })
    .returning();

  if (!created) {
    throw new CartError("CART_NOT_FOUND", "Failed to open a cart");
  }

  return created;
}

/** The open cart with its lines and the product behind each one. */
export async function getOpenCart(owner: CartOwner) {
  const cart = await getOrCreateOpenCart(owner);

  const lines = await db
    .select({
      buildId: cartItems.buildId,
      id: cartItems.id,
      inStock: products.stock,
      name: products.name,
      productId: products.id,
      quantity: cartItems.quantity,
      /** Live price, not the snapshot — the snapshot is only for comparison. */
      unitPricePaise: products.price,
      unitPriceWhenAddedPaise: cartItems.unitPricePaise,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cart.id));

  return {
    cart,
    lines,
    subtotalPaise: lines.reduce(
      (sum, line) => sum + line.unitPricePaise * line.quantity,
      0
    ),
  };
}

export async function getCartByIdOrThrow(params: {
  buyerIdentifier: string;
  cartId: string;
  merchantId: string;
}) {
  const cart = await db.query.carts.findFirst({
    where: and(
      eq(carts.id, params.cartId),
      eq(carts.merchantId, params.merchantId),
      eq(carts.buyerIdentifier, params.buyerIdentifier)
    ),
    with: { items: true },
  });

  if (!cart) {
    throw new CartError("CART_NOT_FOUND", `No cart found for ${params.cartId}`);
  }

  return cart;
}

/**
 * Adds a line, or raises the quantity of one already there.
 *
 * Lines are keyed by product *and* build, so the same drive can sit in the
 * cart once as part of a build and once as a spare without the two merging
 * into a quantity nobody chose.
 */
export async function addToCart(
  owner: CartOwner,
  input: { buildId?: string | null; productId: string; quantity?: number }
) {
  const cart = await getOrCreateOpenCart(owner);

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, input.productId),
      eq(products.merchantId, owner.merchantId),
      eq(products.isActive, true)
    ),
  });

  if (!product) {
    throw new CartError(
      "PRODUCT_NOT_FOUND",
      `Product ${input.productId} is not available in this store`
    );
  }

  const quantity = Math.min(
    Math.max(input.quantity ?? 1, 1),
    MAX_QUANTITY_PER_LINE
  );

  const existing = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cart.id),
      eq(cartItems.productId, product.id),
      input.buildId
        ? eq(cartItems.buildId, input.buildId)
        : isNull(cartItems.buildId)
    ),
  });

  if (existing) {
    const merged = Math.min(
      existing.quantity + quantity,
      MAX_QUANTITY_PER_LINE
    );

    await db
      .update(cartItems)
      .set({ quantity: merged, unitPricePaise: product.price })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      buildId: input.buildId ?? null,
      cartId: cart.id,
      productId: product.id,
      quantity,
      unitPricePaise: product.price,
    });
  }

  return await getOpenCart(owner);
}

/** Removes a line entirely, or reduces it by a quantity. */
export async function removeFromCart(
  owner: CartOwner,
  input: { buildId?: string | null; productId: string; quantity?: number }
) {
  const cart = await getOrCreateOpenCart(owner);

  const existing = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cart.id),
      eq(cartItems.productId, input.productId),
      input.buildId
        ? eq(cartItems.buildId, input.buildId)
        : isNull(cartItems.buildId)
    ),
  });

  if (!existing) {
    throw new CartError(
      "LINE_NOT_FOUND",
      `Product ${input.productId} is not in the cart`
    );
  }

  const remaining = input.quantity ? existing.quantity - input.quantity : 0;

  if (remaining > 0) {
    await db
      .update(cartItems)
      .set({ quantity: remaining })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.delete(cartItems).where(eq(cartItems.id, existing.id));
  }

  return await getOpenCart(owner);
}

/** Puts every part of a build into the cart as one coherent group. */
export async function addBuildToCart(
  owner: CartOwner,
  params: { buildId: string }
) {
  const build = await db.query.builds.findFirst({
    where: (table, { and: every, eq: equals }) =>
      every(
        equals(table.id, params.buildId),
        equals(table.merchantId, owner.merchantId),
        equals(table.buyerIdentifier, owner.buyerIdentifier)
      ),
    with: { items: true },
  });

  if (!build) {
    throw new BuildError(
      "BUILD_NOT_FOUND",
      `No build found for ${params.buildId}`
    );
  }

  for (const item of build.items) {
    await addToCart(owner, {
      buildId: build.id,
      productId: item.productId,
      quantity: item.quantity,
    });
  }

  return await getOpenCart(owner);
}

export interface CartBuildValidation {
  buildId: string;
  validation: BuildValidation;
}

/**
 * Validates the builds a cart contains, as the cart actually holds them.
 *
 * The lines are validated rather than the stored build, because a buyer who
 * removed the case from a cart is buying a build without a case whatever the
 * build row still says. Loose lines are not validated at all: a processor
 * bought as a spare is not an incomplete computer, and running
 * `build_completeness` over it would refuse a perfectly ordinary purchase.
 */
export async function validateCartBuilds(params: {
  buyerIdentifier: string;
  cartId: string;
  merchantId: string;
}): Promise<CartBuildValidation[]> {
  const cart = await getCartByIdOrThrow(params);

  const buildIds = [
    ...new Set(
      cart.items
        .map((item) => item.buildId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const results: CartBuildValidation[] = [];

  for (const buildId of buildIds) {
    const selections = cart.items
      .filter((item) => item.buildId === buildId)
      .map((item) => ({ productId: item.productId, quantity: item.quantity }));

    const components = await loadBuildComponents(params.merchantId, selections);

    results.push({ buildId, validation: validateBuild(components) });
  }

  return results;
}

/** Marks the cart as ordered and links it to the order it became. */
export async function markCartOrdered(cartId: string, orderId: string) {
  await db
    .update(carts)
    .set({ orderId, status: "ordered" })
    .where(eq(carts.id, cartId));
}

/** Cart lines in the shape the checkout path prices. */
export async function cartCheckoutLines(params: {
  buyerIdentifier: string;
  cartId: string;
  merchantId: string;
}) {
  const cart = await getCartByIdOrThrow(params);

  if (cart.items.length === 0) {
    throw new CartError("CART_NOT_FOUND", "The cart is empty");
  }

  return cart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
}
