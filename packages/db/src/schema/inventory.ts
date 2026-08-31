import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { merchants, products } from "./business";

/**
 * The operational side of stock.
 *
 * `products.stock` stays the authoritative on-hand count — the payment path
 * already draws it down, and splitting the number the money touches across two
 * tables would be a way to lose it. What lives here is everything the admin
 * agent needs to say something useful *about* that number: when to worry, how
 * much to order, and how long the order takes to arrive.
 *
 * Nullable rather than defaulted, for the same reason as the specs: a product
 * with no reorder point has not been configured, which is a different fact
 * from one whose reorder point is zero, and §10 asks the admin agent to
 * surface its assumptions rather than invent them.
 */
export const inventory = pgTable(
  "inventory",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastRestockedAt: timestamp("last_restocked_at"),
    /** Below this, the product is reported as low stock. */
    lowStockThreshold: integer("low_stock_threshold"),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** At or below this, a reorder should be raised. */
    reorderPoint: integer("reorder_point"),
    /** How many to order when it is. */
    reorderQuantity: integer("reorder_quantity"),
    supplierLeadTimeDays: integer("supplier_lead_time_days"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_productId_uidx").on(table.productId),
    index("inventory_merchantId_idx").on(table.merchantId),
  ]
);
