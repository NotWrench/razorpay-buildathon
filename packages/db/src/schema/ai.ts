import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { merchants, orders, products } from "./business";

export const conversations = pgTable(
  "conversations",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    buyerType: text("buyer_type", { enum: ["human", "ai_agent"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("conversations_merchantId_idx").on(table.merchantId),
    index("conversations_buyerIdentifier_idx").on(table.buyerIdentifier),
  ]
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    content: text("content").notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    role: text("role", {
      enum: ["user", "assistant", "system", "tool"],
    }).notNull(),
    toolCalls: jsonb("tool_calls").$type<Record<string, unknown>[] | unknown>(),
  },
  (table) => [
    index("conversation_messages_conversationId_idx").on(table.conversationId),
  ]
);

export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    accepted: boolean("accepted").default(false).notNull(),
    confidenceScore: real("confidence_score").notNull(), // e.g. 0.94
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // Human-readable justification
    recommendationType: text("recommendation_type", {
      enum: ["search_result", "upsell", "bundle"],
    }).notNull(),
  },
  (table) => [
    index("ai_recommendations_conversationId_idx").on(table.conversationId),
    index("ai_recommendations_productId_idx").on(table.productId),
  ]
);

export const agentMemoryLong = pgTable(
  "agent_memory_long",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    importanceScore: real("importance_score").notNull(),
    lastAccessed: timestamp("last_accessed").defaultNow().notNull(),
    memoryKey: text("memory_key").notNull(), // e.g. "preferred_brand"
    memoryValue: text("memory_value").notNull(), // e.g. "Sony"
  },
  (table) => [
    index("agent_memory_long_buyerIdentifier_idx").on(table.buyerIdentifier),
    index("agent_memory_long_memoryKey_idx").on(table.memoryKey),
  ]
);

export const reasoningLogs = pgTable(
  "reasoning_logs",
  {
    actionTaken: text("action_taken").notNull(),
    confidence: real("confidence").notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    stepNumber: integer("step_number").notNull(),
    thoughtSummary: text("thought_summary").notNull(),
  },
  (table) => [
    index("reasoning_logs_conversationId_idx").on(table.conversationId),
    index("reasoning_logs_stepNumber_idx").on(table.stepNumber),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    action: text("action").notNull(), // "ORDER_CREATED", "PAYMENT_AUTHORIZED", "CAMPAIGN_APPROVED", "BUDGET_CHECK_PASSED"
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type", {
      enum: [
        "human_buyer",
        "merchant",
        "ai_assistant",
        "external_ai_agent",
        "system",
      ],
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    explanation: text("explanation").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("audit_logs_merchantId_idx").on(table.merchantId),
    index("audit_logs_orderId_idx").on(table.orderId),
    index("audit_logs_actorType_idx").on(table.actorType),
    index("audit_logs_action_idx").on(table.action),
  ]
);

export const failures = pgTable(
  "failures",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    errorMessage: text("error_message").notNull(),
    errorType: text("error_type").notNull(), // "PAYMENT_DECLINED", "BUDGET_EXCEEDED", "OUT_OF_STOCK"
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    recoveryAction: text("recovery_action"), // "RETRY_LINK_GENERATED", "DOWNGRADED_CART"
    resolved: boolean("resolved").default(false).notNull(),
  },
  (table) => [
    index("failures_orderId_idx").on(table.orderId),
    index("failures_errorType_idx").on(table.errorType),
    index("failures_resolved_idx").on(table.resolved),
  ]
);
