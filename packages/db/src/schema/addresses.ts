import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { merchants } from "./business";

/**
 * The buyer's address book.
 *
 * The account page has shown an Addresses section since it was built, backed by
 * a hardcoded empty array and an Edit pill wired to nothing — the section was
 * honest about having no addresses because there was nowhere to put one.
 *
 * Ownership follows `builds` and `carts`: `buyer_identifier` is the identity,
 * `user_id` is set when there is an account behind it and null for a guest.
 * That pairing is what lets a guest keep an address across a session and
 * inherit it if they sign up, without the address ever escaping its store.
 *
 * The shape is deliberately Indian-postal rather than generic: `pincode` is six
 * digits and `state` is a state, because this store prices in paise and ships
 * domestically. A `country` column would be a field nobody ever changes.
 *
 * `is_primary` is text-free: exactly one address per buyer should carry it, and
 * that invariant is enforced in the action rather than by a partial unique
 * index — unsetting the old primary and setting the new one is a two-statement
 * change, and a unique index would reject the intermediate state.
 */
export const addresses = pgTable(
  "addresses",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    city: text("city").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /** "Home", "Office" — the shopper's own word for it. */
    label: text("label").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    phone: text("phone"),
    pincode: text("pincode").notNull(),
    /** The one the checkout should reach for. See the note above. */
    primary: text("is_primary", { enum: ["yes", "no"] })
      .default("no")
      .notNull(),
    state: text("state").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("addresses_merchantId_idx").on(table.merchantId),
    index("addresses_buyerIdentifier_idx").on(table.buyerIdentifier),
  ]
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
