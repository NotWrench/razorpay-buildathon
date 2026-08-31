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

export const conversations = pgTable(
  "conversations",
  {
    buyerIdentifier: text("buyer_identifier").notNull(),
    buyerType: text("buyer_type", { enum: ["human", "ai_agent"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * The owning merchant, in the project database. Not a foreign key: this
     * table lives in `razorpay_agent_memory` and Postgres cannot reference
     * across databases.
     */
    merchantId: uuid("merchant_id").notNull(),
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
    /** Cross-database reference to `products.id`. */
    productId: uuid("product_id").notNull(),
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

/**
 * What the buyer said they need, as structured state rather than transcript.
 *
 * §3.2 asks the agent to interview a buyer who does not know what to buy, and
 * to "avoid unnecessary questions". Neither is checkable while the answers live
 * only in the conversation: the model has to re-derive the budget from prose
 * every turn, and nothing can tell whether a question has already been asked.
 *
 * With a row per conversation, "ask only for what is still missing" becomes a
 * null check. Every column is nullable because an interview is answered a
 * piece at a time, and a null here means *not yet asked or not yet answered* —
 * the same discipline the specs follow, for the same reason.
 *
 * This lives in the agent database because it is something the agent wrote
 * while reasoning, not a fact about the business (§15).
 */
export const buildRequirements = pgTable(
  "build_requirements",
  {
    /** Ceiling the buyer stated, in paise. Null means they have not said. */
    budgetPaise: integer("budget_paise"),
    /** Hard limits: form factor, noise, an existing case to reuse. */
    constraints: jsonb("constraints").$type<Record<string, unknown>>(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" })
      .unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /** Parts they already own and want to keep, so they are not re-sold. */
    ownedParts: jsonb("owned_parts").$type<Record<string, unknown>>(),
    targetRefreshHz: integer("target_refresh_hz"),
    /** "1080p" | "1440p" | "4K" — as the buyer said it. */
    targetResolution: text("target_resolution"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** Gaming, editing, development, office work, mixed. */
    useCase: text("use_case"),
    /** Named games or software, which bind a recommendation to something real. */
    workloads: jsonb("workloads").$type<string[]>(),
  },
  (table) => [
    index("build_requirements_conversationId_idx").on(table.conversationId),
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
    /**
     * The owning merchant, in the project database. Not a foreign key: this
     * table lives in `razorpay_agent_memory` and Postgres cannot reference
     * across databases.
     */
    merchantId: uuid("merchant_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /**
     * Cross-database reference to `orders.id`.
     *
     * Deliberately not enforced: an audit or failure row is a true record of
     * what happened and should outlive the order it describes.
     */
    orderId: uuid("order_id"),
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
    /**
     * Cross-database reference to `orders.id`.
     *
     * Deliberately not enforced: an audit or failure row is a true record of
     * what happened and should outlive the order it describes.
     */
    orderId: uuid("order_id"),
    recoveryAction: text("recovery_action"), // "RETRY_LINK_GENERATED", "DOWNGRADED_CART"
    resolved: boolean("resolved").default(false).notNull(),
  },
  (table) => [
    index("failures_orderId_idx").on(table.orderId),
    index("failures_errorType_idx").on(table.errorType),
    index("failures_resolved_idx").on(table.resolved),
  ]
);
