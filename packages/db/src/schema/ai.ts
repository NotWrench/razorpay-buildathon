import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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

/**
 * What the agent put in front of the buyer, and why.
 *
 * §3.3 asks for two levels: the best fit, and — only sometimes — an upgrade.
 * §5 then says the agent must not manipulate anyone into spending more. That
 * rule is enforced here rather than in a prompt, by making a bad upgrade
 * impossible to write down: an `upgrade` row must carry
 * `tied_to_requirement`, naming the stated goal it serves.
 *
 * An upgrade with no goal to point at cannot be expressed, and an upgrade
 * nobody needs is simply an absent row. Making the absence representable is
 * the whole trick — "a faster card exists" is not a reason, and now there is
 * nowhere to put it.
 */
export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    accepted: boolean("accepted").default(false).notNull(),
    /** What the upgrade costs over the best fit, in paise. Upgrades only. */
    additionalSpendPaise: integer("additional_spend_paise"),
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
      enum: ["search_result", "best_fit", "upgrade", "upsell", "bundle"],
    }).notNull(),
    /** The best fit this upgrade is offered against. Upgrades only. */
    replacesProductId: uuid("replaces_product_id"),
    /**
     * Which stated requirement the extra spend serves.
     *
     * Required for an upgrade by a check constraint, not by convention — see
     * the note above. This is §5 made structural.
     */
    tiedToRequirement: text("tied_to_requirement"),
  },
  (table) => [
    index("ai_recommendations_conversationId_idx").on(table.conversationId),
    index("ai_recommendations_productId_idx").on(table.productId),
    check(
      "ai_recommendations_upgrade_needs_a_reason",
      sql`${table.recommendationType} <> 'upgrade' or (${table.tiedToRequirement} is not null and ${table.additionalSpendPaise} is not null)`
    ),
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
    /**
     * Ceiling the buyer stated, in paise. Null means they have not said.
     *
     * A bigint because paise overflow a 32-bit integer at ₹2,14,748 — a
     * budget a buyer could plausibly state — and the overflow surfaces as a
     * Postgres range error mid-interview, which the buyer reads as the
     * assistant breaking. The tool schema still refuses anything that cannot
     * be a PC budget; this is the column being the wrong width regardless.
     */
    budgetPaise: bigint("budget_paise", { mode: "number" }),
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

/**
 * One row per tool execution.
 *
 * Tool calls were already stored as jsonb on the assistant message, which is
 * enough to read a transcript back and useless for anything else: you cannot
 * ask which tool fails most, what the median latency is, or whether a denied
 * approval actually stopped anything, because the answer is buried inside a
 * document per message.
 *
 * §24 asks for per-call telemetry, so this is that — one row, written from the
 * SDK's own execution callbacks rather than by wrapping each tool, so no tool
 * has to remember to log and none can be added that forgets.
 *
 * `output_summary` is a summary on purpose. A full tool result can be an
 * entire catalog page, and keeping every one of them would turn an
 * observability table into a second copy of the database. What is kept is
 * shape and size — enough to spot a tool that started returning nothing.
 */
export const agentToolCalls = pgTable(
  "agent_tool_calls",
  {
    agentType: text("agent_type", { enum: ["customer", "admin"] }).notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** Populated when the call errored or was denied. */
    errorText: text("error_text"),
    id: uuid("id").defaultRandom().primaryKey(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    latencyMs: integer("latency_ms"),
    /** The §6 chat mode in force, when one was selected. */
    mode: text("mode"),
    outputSummary: jsonb("output_summary").$type<Record<string, unknown>>(),
    /**
     * `denied` is its own state, not an error.
     *
     * An approval the human refused is the system working, and counting it as
     * a failure would make the guardrail look like a defect in the dashboard.
     */
    status: text("status", { enum: ["ok", "error", "denied"] }).notNull(),
    /** Which step of the tool loop this was. */
    stepNumber: integer("step_number"),
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name").notNull(),
  },
  (table) => [
    index("agent_tool_calls_conversationId_idx").on(table.conversationId),
    index("agent_tool_calls_toolName_idx").on(table.toolName),
    index("agent_tool_calls_status_idx").on(table.status),
    index("agent_tool_calls_createdAt_idx").on(table.createdAt),
  ]
);

/**
 * What the agent was asked to do, and whether it got there.
 *
 * A conversation is a transcript; a task is an intent with an outcome. §26's
 * domain model wants both, because "did the agent help" is not answerable from
 * message counts — a shopper who asked for a build and left without one had a
 * conversation that looks entirely healthy.
 */
export const agentTasks = pgTable(
  "agent_tasks",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    /** What the buyer was trying to do, in their terms. */
    intent: text("intent").notNull(),
    mode: text("mode"),
    /** How it ended. Null while the task is still open. */
    outcome: text("outcome", {
      enum: ["resolved", "abandoned", "handed_off", "failed"],
    }),
    /** Free-form detail on the outcome — which build, which order, why not. */
    outcomeDetail: text("outcome_detail"),
    state: text("state", { enum: ["open", "closed"] })
      .default("open")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_tasks_conversationId_idx").on(table.conversationId),
    index("agent_tasks_state_idx").on(table.state),
  ]
);

/**
 * What the person thought of it.
 *
 * The only signal in the agent database that does not come from the agent, and
 * therefore the only one that can contradict it. A recommendation the model
 * scored 0.9 and the buyer thumbed down is the interesting row in this schema.
 */
export const agentFeedback = pgTable(
  "agent_feedback",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    note: text("note"),
    /** The recommendation being judged, when the feedback is about one. */
    recommendationId: uuid("recommendation_id").references(
      () => aiRecommendations.id,
      { onDelete: "cascade" }
    ),
    thumbs: text("thumbs", { enum: ["up", "down"] }).notNull(),
  },
  (table) => [
    index("agent_feedback_conversationId_idx").on(table.conversationId),
    index("agent_feedback_recommendationId_idx").on(table.recommendationId),
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
