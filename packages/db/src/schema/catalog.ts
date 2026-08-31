import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { merchants } from "./business";

/**
 * The component taxonomy.
 *
 * `products.category` used to be free text, which made "is this a GPU?" a
 * string-matching question and left the compatibility engine with nothing
 * dependable to key on. A category row instead states what a component *is*
 * and how it behaves inside a build: whether it occupies a slot, which slot,
 * and how many of it a build may hold.
 *
 * Categories are per-merchant. The platform is multi-tenant even though the
 * demo has one store, and a taxonomy row that cannot name its owner is the
 * kind of thing that is painful to retrofit later.
 */
export const productCategories = pgTable(
  "product_categories",
  {
    /** Which build slot this category fills — null when it is not a component. */
    buildSlot: text("build_slot"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /** Does a product in this category occupy a slot in a PC build? */
    isBuildComponent: boolean("is_build_component").default(false).notNull(),
    /** How many a complete build may hold. Null means unlimited. */
    maxPerBuild: integer("max_per_build"),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** How many a complete build must hold. Zero means optional. */
    minPerBuild: integer("min_per_build").default(0).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("product_categories_merchantId_idx").on(table.merchantId),
    uniqueIndex("product_categories_merchantId_slug_uidx").on(
      table.merchantId,
      table.slug
    ),
  ]
);
