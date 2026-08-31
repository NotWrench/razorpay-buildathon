import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { merchants, products } from "./business";

/**
 * A PC build: the structured configuration §2 asks for.
 *
 * The point is that the system knows which slot each product fills, so the
 * build can be validated before checkout rather than argued about in prose. A
 * conversation that says "and a 4080" is not a build; a row here with a
 * `build_items` entry in the `gpu` slot is.
 *
 * Ownership is `buyer_identifier` — the same stable identity `orders` uses,
 * an email for a signed-in shopper and an API key id for an agent. That makes
 * every authorization check here the one the order tools already run, and
 * means a build and the order it becomes agree about whose they are. `user_id`
 * is carried alongside for joins, and is null for an agent buyer.
 */
export const builds = pgTable(
  "builds",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    /** The turn it was created in, for the audit trail. Not an ownership key. */
    conversationId: uuid("conversation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /**
     * `validated` records that the engine passed it, not that it is current —
     * a build reverts to `draft` on any edit, because a stale pass is worse
     * than no pass at all.
     */
    status: text("status", { enum: ["draft", "validated", "ordered"] })
      .default("draft")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("builds_merchantId_idx").on(table.merchantId),
    index("builds_buyerIdentifier_idx").on(table.buyerIdentifier),
    index("builds_status_idx").on(table.status),
  ]
);

/**
 * One part in a build, and the slot it fills.
 *
 * `category_slug` is denormalised from the product rather than joined for it,
 * so the compatibility engine can be handed a build without a second query and
 * so a later recategorisation cannot silently move a part between slots in a
 * build somebody already validated.
 */
export const buildItems = pgTable(
  "build_items",
  {
    buildId: uuid("build_id")
      .notNull()
      .references(() => builds.id, { onDelete: "cascade" }),
    categorySlug: text("category_slug").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * The part the slot is really about, where several share one.
     *
     * Storage takes up to four drives and only one of them is the boot drive;
     * marking it lets a recommendation talk about "the boot drive" without
     * guessing which of them it meant.
     */
    isPrimary: boolean("is_primary").default(false).notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
  },
  (table) => [
    index("build_items_buildId_idx").on(table.buildId),
    index("build_items_productId_idx").on(table.productId),
  ]
);
