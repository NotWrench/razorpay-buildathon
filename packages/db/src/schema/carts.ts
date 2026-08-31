import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { builds } from "./builds";
import { merchants, products } from "./business";

/**
 * The buyer's open basket.
 *
 * A cart existed before this only as an array inside one request, which meant
 * it could not survive a refresh, be quoted twice, or be handed to the
 * merchant to look at. Ownership follows `builds`: `buyer_identifier`, the
 * same identity `orders` uses.
 *
 * One open cart per buyer per store, enforced by a partial unique index rather
 * than by convention, because two open carts is not a state any caller here
 * knows how to resolve. Ordered and abandoned carts are kept — an abandoned
 * cart is the most useful thing in the table for §11.
 */
export const carts = pgTable(
  "carts",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    conversationId: uuid("conversation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** Set when the cart becomes an order, so the trail runs both ways. */
    orderId: uuid("order_id"),
    status: text("status", { enum: ["open", "ordered", "abandoned"] })
      .default("open")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("carts_merchantId_idx").on(table.merchantId),
    index("carts_buyerIdentifier_idx").on(table.buyerIdentifier),
    uniqueIndex("carts_open_per_buyer_uidx")
      .on(table.merchantId, table.buyerIdentifier)
      .where(sql`${table.status} = 'open'`),
  ]
);

/**
 * One line in the cart.
 *
 * `build_id` is what lets a whole validated build enter the cart as a coherent
 * group while individual components can still be bought loose. It is also the
 * signal checkout keys on: lines that belong to a build get re-validated
 * together, and loose lines do not, because a single processor bought as a
 * spare is not an incomplete computer.
 *
 * `unit_price_paise` is a snapshot for display and for noticing that a price
 * moved while the cart sat. It is never what the buyer is charged — pricing is
 * re-derived from live product rows at checkout, and that stays the only place
 * a price is decided.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    /** Null for a loose component; set when the line belongs to a build. */
    buildId: uuid("build_id").references(() => builds.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    /** Indicative only — see the note above. */
    unitPricePaise: integer("unit_price_paise").notNull(),
  },
  (table) => [
    index("cart_items_cartId_idx").on(table.cartId),
    index("cart_items_productId_idx").on(table.productId),
    index("cart_items_buildId_idx").on(table.buildId),
  ]
);
