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
 * A request to buy more of something from a supplier.
 *
 * This is business data, not agent reasoning, so it lives in the project
 * database: it outlives the conversation that raised it, a human approves it,
 * and it eventually corresponds to money leaving the business.
 *
 * `created_by_agent` is kept rather than inferred from `approved_by` being
 * null, because "the assistant suggested this" stays true after a merchant
 * approves it. §12 wants the provenance of an action visible at the point
 * somebody acts on it, not reconstructed from what else is missing.
 *
 * Nothing here moves money on its own. A request reaching `ordered` means a
 * human decided to place it; this table records the decision, it does not make
 * it.
 */
export const reorderRequests = pgTable(
  "reorder_requests",
  {
    approvedAt: timestamp("approved_at"),
    /** The merchant who approved it. Null while it is still a draft. */
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** Provenance, kept true after approval. */
    createdByAgent: boolean("created_by_agent").default(false).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    /**
     * The evidence behind the request, in the merchant's terms.
     *
     * Required, because a reorder with no stated basis is one nobody can check
     * — the same discipline `ai_recommendations` applies to an upgrade.
     */
    reason: text("reason").notNull(),
    status: text("status", {
      enum: ["draft", "approved", "ordered", "received", "cancelled"],
    })
      .default("draft")
      .notNull(),
    /** What the stock was when the request was raised, for later review. */
    stockAtRequest: integer("stock_at_request"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reorder_requests_merchantId_idx").on(table.merchantId),
    index("reorder_requests_productId_idx").on(table.productId),
    index("reorder_requests_status_idx").on(table.status),
  ]
);
