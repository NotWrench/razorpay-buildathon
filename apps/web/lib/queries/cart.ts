import type { CartBuildValidation } from "@workspace/commerce/carts";
import { validateCartBuilds } from "@workspace/commerce/carts";
import { cartItems, carts, db, type Product, products } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * The cart a page renders.
 *
 * Read-only on purpose. `getOrCreateOpenCart` in `@workspace/commerce` is the
 * right call from a mutation, but a header that renders on every page must not
 * write a row: a guest whose identity is minted per request would leave an
 * empty cart behind on every navigation. Nothing here creates anything — the
 * first `addToCart` does.
 *
 * The line price is the live product price, never the snapshot taken when the
 * line was added. Both are carried so the cart can say "this went up while you
 * were away" rather than quietly repricing.
 */

export interface CartLineView {
  buildId: string | null;
  id: string;
  inStock: number;
  name: string;
  priceChanged: boolean;
  product: Product;
  productId: string;
  quantity: number;
  unitPricePaise: number;
  unitPriceWhenAddedPaise: number;
}

export interface CartView {
  buildValidations: CartBuildValidation[];
  cartId: string | null;
  lines: CartLineView[];
  subtotalPaise: number;
}

const EMPTY: CartView = {
  buildValidations: [],
  cartId: null,
  lines: [],
  subtotalPaise: 0,
};

export interface CartScope {
  buyerIdentifier: string;
  merchantId: string;
}

async function findOpenCart(scope: CartScope) {
  return await db.query.carts.findFirst({
    where: and(
      eq(carts.merchantId, scope.merchantId),
      eq(carts.buyerIdentifier, scope.buyerIdentifier),
      eq(carts.status, "open")
    ),
  });
}

export async function loadCartView(scope: CartScope): Promise<CartView> {
  const cart = await findOpenCart(scope);

  if (!cart) {
    return EMPTY;
  }

  const rows = await db
    .select({
      buildId: cartItems.buildId,
      id: cartItems.id,
      product: products,
      quantity: cartItems.quantity,
      unitPriceWhenAddedPaise: cartItems.unitPricePaise,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cart.id));

  const lines: CartLineView[] = rows.map((row) => ({
    buildId: row.buildId,
    id: row.id,
    inStock: row.product.stock,
    name: row.product.name,
    priceChanged: row.product.price !== row.unitPriceWhenAddedPaise,
    product: row.product,
    productId: row.product.id,
    quantity: row.quantity,
    unitPricePaise: row.product.price,
    unitPriceWhenAddedPaise: row.unitPriceWhenAddedPaise,
  }));

  const buildValidations = lines.some((line) => line.buildId)
    ? await validateCartBuilds({ ...scope, cartId: cart.id })
    : [];

  return {
    buildValidations,
    cartId: cart.id,
    lines,
    subtotalPaise: lines.reduce(
      (sum, line) => sum + line.unitPricePaise * line.quantity,
      0
    ),
  };
}

/** How many units are in the basket, for the header badge. */
export async function countCartItems(scope: CartScope): Promise<number> {
  const cart = await findOpenCart(scope);

  if (!cart) {
    return 0;
  }

  const rows = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id));

  return rows.reduce((sum, row) => sum + row.quantity, 0);
}
