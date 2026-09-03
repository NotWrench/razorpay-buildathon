import {
  builds,
  cartItems,
  carts,
  db,
  inventory,
  productSpecs,
  products,
} from "@workspace/db";
import { REQUIRED_BUILD_SLOTS } from "@workspace/db/taxonomy";
import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { currentBuyer } from "@/lib/store/buyer";
import { toSummary } from "./product";
import { storeId } from "./store";
import type { Cart, CartBuild, CartLine, CompatibilityState } from "./types";

/**
 * The basket, as the cart screen reads it.
 *
 * Read-only. `getOrCreateOpenCart` is the right call from a mutation and the
 * wrong one from a page: a guest identity is minted per request until they
 * touch something, so a header that created a cart on render would leave an
 * empty row behind on every navigation.
 *
 * Money here matches what the gateway will actually charge —
 * `createCheckoutOrder` prices a cart as `subtotal − discount`, with no tax or
 * shipping line, because the catalogue is GST-inclusive Indian retail. A
 * summary that added 18% on top would be quoting a total nobody is going to
 * take.
 */

const EMPTY: Cart = {
  builds: [],
  discountPaise: 0,
  lines: [],
  shippingPaise: 0,
  subtotalPaise: 0,
  taxPaise: 0,
  totalPaise: 0,
};

/** The one open cart for this buyer and store, if they have touched anything. */
async function findOpenCart(merchantId: string, buyerIdentifier: string) {
  return await db.query.carts.findFirst({
    where: and(
      eq(carts.merchantId, merchantId),
      eq(carts.buyerIdentifier, buyerIdentifier),
      eq(carts.status, "open")
    ),
  });
}

export const getCart = cache(async (): Promise<Cart> => {
  const merchantId = await storeId();
  const buyer = await currentBuyer();
  const cart = await findOpenCart(merchantId, buyer.identifier);

  if (!cart) {
    return EMPTY;
  }

  const rows = await db
    .select({
      buildId: cartItems.buildId,
      lowStockThreshold: inventory.lowStockThreshold,
      product: products,
      quantity: cartItems.quantity,
      specs: productSpecs,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(productSpecs, eq(productSpecs.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));

  if (rows.length === 0) {
    return EMPTY;
  }

  const buildIds = [
    ...new Set(
      rows.map((row) => row.buildId).filter((id): id is string => id !== null)
    ),
  ];

  const buildRows =
    buildIds.length > 0
      ? await db
          .select({ id: builds.id, name: builds.name })
          .from(builds)
          .where(
            and(eq(builds.merchantId, merchantId), inArray(builds.id, buildIds))
          )
      : [];

  const cartBuilds: CartBuild[] = buildRows.map((build) => ({
    id: build.id,
    name: build.name,
    requiredSlots: [...REQUIRED_BUILD_SLOTS],
  }));

  const lines: CartLine[] = rows.map((row) => ({
    buildId: row.buildId ?? undefined,
    issue: stockIssue(row.quantity, row.product.stock),
    product: toSummary(row),
    quantity: row.quantity,
  }));

  const subtotalPaise = lines.reduce(
    (total, line) => total + line.product.pricePaise * line.quantity,
    0
  );

  return {
    builds: cartBuilds,
    discountPaise: 0,
    lines,
    shippingPaise: 0,
    subtotalPaise,
    taxPaise: 0,
    totalPaise: subtotalPaise,
  };
});

/**
 * The one thing a line can be wrong about on its own.
 *
 * Compatibility findings belong to a build rather than to a line — the cart
 * screen already prints those above the group they concern — so what attaches
 * to a row here is the fact only that row knows: more of it is in the basket
 * than the store has left.
 */
function stockIssue(
  quantity: number,
  onHand: number
): { message: string; state: CompatibilityState } | undefined {
  if (onHand <= 0) {
    return {
      message: "Out of stock. This line cannot be ordered.",
      state: "incompatible",
    };
  }

  if (quantity > onHand) {
    return {
      message: `Only ${onHand} left — this line asks for ${quantity}.`,
      state: "needs_verification",
    };
  }
}

/** How many units are in the basket, for the header badge. */
export const countCart = cache(async (): Promise<number> => {
  const merchantId = await storeId();
  const buyer = await currentBuyer();
  const cart = await findOpenCart(merchantId, buyer.identifier);

  if (!cart) {
    return 0;
  }

  const rows = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id));

  return rows.reduce((sum, row) => sum + row.quantity, 0);
});

/** The open cart's id, for the checkout action. Null when nothing is in it. */
export async function openCartId(): Promise<string | null> {
  const merchantId = await storeId();
  const buyer = await currentBuyer();
  const cart = await findOpenCart(merchantId, buyer.identifier);

  return cart?.id ?? null;
}
