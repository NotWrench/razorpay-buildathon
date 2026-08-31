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
     * Free-text category, kept only until the taxonomy backfill is verified.
     *
     * `categoryId` is the authoritative answer to "what is this product".
     */
    category: text("category"),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    embedding: vector("embedding", { dimensions: 1536 }),
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

export const campaigns = pgTable(
  "campaigns",
  {
    aiGeneratedReason: text("ai_generated_reason"), // Explainable business reasoning
    approvedByMerchant: boolean("approved_by_merchant")
      .default(false)
      .notNull(),
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
    status: text("status", {
      enum: ["draft", "pending_approval", "active", "rejected", "expired"],
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
