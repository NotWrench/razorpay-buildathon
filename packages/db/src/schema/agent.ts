import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  aiRecommendationsRelations,
  conversationMessagesRelations,
  conversationsRelations,
  reasoningLogsRelations,
} from "./agent-relations";
import {
  agentMemoryLong,
  aiRecommendations,
  auditLogs,
  conversationMessages,
  conversations,
  failures,
  reasoningLogs,
} from "./ai";

/**
 * The agent database (`razorpay_agent_memory`).
 *
 * Everything the AI writes: what was said, what it reasoned, what it
 * recommended, what it remembers, and the audit trail of every action it took.
 * Separate from the business data so it can be queried, retained and cleared on
 * its own — see `packages/db/README.md`.
 *
 * This module is also the schema entry point for `drizzle.agent.config.ts`, so
 * anything exported here becomes a table in that database.
 */

export {
  aiRecommendationsRelations,
  conversationMessagesRelations,
  conversationsRelations,
  reasoningLogsRelations,
} from "./agent-relations";
export {
  agentMemoryLong,
  aiRecommendations,
  auditLogs,
  conversationMessages,
  conversations,
  failures,
  reasoningLogs,
} from "./ai";

/** Aggregation passed to `drizzle()` for the agent client. */
export const agentSchema = {
  agentMemoryLong,
  aiRecommendations,
  aiRecommendationsRelations,
  auditLogs,
  conversationMessages,
  conversationMessagesRelations,
  conversations,
  conversationsRelations,
  failures,
  reasoningLogs,
  reasoningLogsRelations,
};

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type ConversationMessage = InferSelectModel<typeof conversationMessages>;
export type NewConversationMessage = InferInsertModel<
  typeof conversationMessages
>;
export type AiRecommendation = InferSelectModel<typeof aiRecommendations>;
export type NewAiRecommendation = InferInsertModel<typeof aiRecommendations>;
export type AgentMemoryLong = InferSelectModel<typeof agentMemoryLong>;
export type NewAgentMemoryLong = InferInsertModel<typeof agentMemoryLong>;
export type ReasoningLog = InferSelectModel<typeof reasoningLogs>;
export type NewReasoningLog = InferInsertModel<typeof reasoningLogs>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type Failure = InferSelectModel<typeof failures>;
export type NewFailure = InferInsertModel<typeof failures>;
