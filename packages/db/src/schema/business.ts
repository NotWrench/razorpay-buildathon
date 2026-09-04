import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { productCategories } from "./catalog";

export const merchants = pgTable(
  "merchants",
  {
    businessName: text("business_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("INR").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    razorpayAccessToken: text("razorpay_access_token"),
    razorpayAccountId: text("razorpay_account_id"),
    razorpayKeyId: text("razorpay_key_id"),
    razorpayKeySecret: text("razorpay_key_secret"),
    razorpayRefreshToken: text("razorpay_refresh_token"),
    storeSlug: text("store_slug").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("merchants_userId_idx").on(table.userId),
    uniqueIndex("merchants_storeSlug_uidx").on(table.storeSlug),
  ]
);

export const products = pgTable(
  "products",
  {
    attributes: jsonb("attributes").$type<Record<string, unknown>>(),
    brand: text("brand"),
    /**
     * The category slug, denormalised from `categoryId`.
     *
     * `categoryId` is authoritative — this is a mirror kept so search, the
     * agent-readable catalog and the storefront can name a category without a
     * join. It is written from the taxonomy and never by hand; free text here
     * is a bug, not a feature.
     */
    category: text("category"),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    /**
     * What the merchant paid for one unit, in paise.
     *
     * Nullable on purpose, following the same rule as the specs: a product
     * with no cost has not been configured, which is a different fact from one
     * that costs nothing. Every tool that reports margin also reports how many
     * products it could not price, because a gross margin computed over half
     * the catalogue and presented as the whole is worse than no figure at all.
     *
     * Without this column "grow revenue" is measured by a number that a 30%
     * discount can always improve. With it there is a floor a discount cannot
     * cross and a question — did that campaign make money — with an answer.
     */
    costPrice: integer("cost_price"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    embedding: vector("embedding", { dimensions: 1536 }),
    /**
     * Which embedding model wrote `embedding`, as `provider:model:dims:regime`.
     *
     * Vectors from two different models are incomparable rather than merely
     * different, so a mixed column silently poisons semantic search instead of
     * failing. Recording the producer turns that into something checkable:
     * search only compares rows written by the model that is embedding the
     * query, and the backfill re-embeds everything that does not match. A null
     * is a row from before this column existed — also a re-embed.
     */
    embeddingModel: text("embedding_model"),
    id: uuid("id").defaultRandom().primaryKey(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true).notNull(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: integer("price").notNull(), // stored in paise / cents (e.g. ₹4,999 = 499900)
    sku: text("sku"),
    stock: integer("stock").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("products_merchantId_idx").on(table.merchantId),
    index("products_category_idx").on(table.category),
    index("products_categoryId_idx").on(table.categoryId),
    index("products_sku_idx").on(table.sku),
    index("products_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const orders = pgTable(
  "orders",
  {
    aiPurchaseReason: text("ai_purchase_reason"), // Explainability record
    approvalStatus: text("approval_status", {
      enum: ["pending_approval", "approved", "rejected"],
    })
      .default("pending_approval")
      .notNull(),
    buyerIdentifier: text("buyer_identifier").notNull(), // Email or Agent API Key ID
    buyerType: text("buyer_type", { enum: ["human", "ai_agent"] }).notNull(),
    /**
     * Which campaign discounted this order, if one did.
     *
     * `discount_amount` recorded that a discount happened and nothing about
     * where it came from, so "did that campaign work?" had no answer: there
     * was no way to separate orders the campaign touched from orders placed
     * the same week. Written at checkout from whatever `quoteCart` actually
     * applied, so the attribution is the discount the buyer was really given
     * rather than a later guess from dates.
     */
    campaignId: uuid("campaign_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("INR").notNull(),
    discountAmount: integer("discount_amount").default(0).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderStatus: text("order_status", {
      enum: ["draft", "created", "paid", "failed", "cancelled"],
    })
      .default("draft")
      .notNull(),
    razorpayOrderId: text("razorpay_order_id"),
    subtotal: integer("subtotal").notNull(),
    totalAmount: integer("total_amount").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("orders_merchantId_idx").on(table.merchantId),
    index("orders_userId_idx").on(table.userId),
    index("orders_buyerIdentifier_idx").on(table.buyerIdentifier),
    index("orders_orderStatus_idx").on(table.orderStatus),
    index("orders_approvalStatus_idx").on(table.approvalStatus),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    isUpsell: boolean("is_upsell").default(false).notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    subtotal: integer("subtotal").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (table) => [
    index("order_items_orderId_idx").on(table.orderId),
    index("order_items_productId_idx").on(table.productId),
  ]
);

export const payments = pgTable(
  "payments",
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("INR").notNull(),
    failureReason: text("failure_reason"),
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentLinkId: text("payment_link_id"),
    paymentLinkUrl: text("payment_link_url"),
    razorpayOrderId: text("razorpay_order_id").notNull(),
    razorpayPaymentId: text("razorpay_payment_id"),
    razorpaySignature: text("razorpay_signature"),
    retryCount: integer("retry_count").default(0).notNull(),
    status: text("status", {
      enum: ["created", "authorized", "captured", "failed", "refunded"],
    })
      .default("created")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payments_orderId_idx").on(table.orderId),
    index("payments_razorpayOrderId_idx").on(table.razorpayOrderId),
    index("payments_razorpayPaymentId_idx").on(table.razorpayPaymentId),
    index("payments_status_idx").on(table.status),
  ]
);

/**
 * Every price this product has ever carried, and who moved it.
 *
 * A price change is not like other edits. It applies to every future order
 * rather than one, it is invisible after the fact — the row simply holds a
 * different number — and the question a merchant asks three weeks later is
 * "why is this ₹4,000 more than it was?", which nothing in the schema could
 * answer.
 *
 * So the old price is kept with the reason and the actor beside it. This is
 * what makes `updateProductPrice` safe enough to exist: the change is bounded
 * before it happens and legible afterwards.
 */
export const productPriceHistory = pgTable(
  "product_price_history",
  {
    /** "merchant" | "ai_assistant" — who actually moved it. */
    actorType: text("actor_type").notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    newPrice: integer("new_price").notNull(),
    oldPrice: integer("old_price").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Required. A price move with no stated basis is one nobody can check. */
    reason: text("reason").notNull(),
  },
  (table) => [
    index("product_price_history_productId_idx").on(table.productId),
    index("product_price_history_merchantId_idx").on(table.merchantId),
  ]
);

export const campaigns = pgTable(
  "campaigns",
  {
    aiGeneratedReason: text("ai_generated_reason"), // Explainable business reasoning
    approvedByMerchant: boolean("approved_by_merchant")
      .default(false)
      .notNull(),
    /**
     * The most this campaign may ever give away, in paise.
     *
     * A campaign that can be started and not stopped is the one genuinely
     * dangerous object in this system: it discounts every matching order from
     * now until somebody notices. The budget is the bound that does not depend
     * on anybody noticing — `spent_paise` climbs as orders are captured, and
     * the campaign stops applying the moment it is exhausted.
     *
     * Null means no cap, which is a decision the merchant makes explicitly
     * rather than a default they never saw.
     */
    budgetPaise: integer("budget_paise"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    discountType: text("discount_type", {
      enum: ["percentage", "flat", "bundle"],
    }).notNull(),
    discountValue: integer("discount_value").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** When it may begin discounting. Null means "as soon as it is active". */
    startsAt: timestamp("starts_at"),
    /** When it stops. Null means it runs until paused or its budget runs out. */
    endsAt: timestamp("ends_at"),
    /** Discount actually given away so far, in paise. */
    spentPaise: integer("spent_paise").default(0).notNull(),
    status: text("status", {
      enum: [
        "draft",
        "pending_approval",
        "active",
        "paused",
        "rejected",
        "expired",
      ],
    })
      .default("draft")
      .notNull(),
    title: text("title").notNull(),
    triggerRules: jsonb("trigger_rules").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("campaigns_merchantId_idx").on(table.merchantId),
    index("campaigns_status_idx").on(table.status),
  ]
);
