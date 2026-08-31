import { relations } from "drizzle-orm";
import {
  agentFeedback,
  agentTasks,
  agentToolCalls,
  aiRecommendations,
  buildRequirements,
  conversationMessages,
  conversations,
  reasoningLogs,
} from "./ai";

/**
 * Relations inside the agent database.
 *
 * Only conversation-scoped links survive here. Everything that pointed at the
 * business schema — `conversations.merchantId`, `aiRecommendations.productId`,
 * `auditLogs.merchantId`, `auditLogs.orderId`, `failures.orderId` — is now a
 * plain uuid resolved with a second query against `db`, because the two live in
 * different Postgres databases.
 */

export const conversationsRelations = relations(
  conversations,
  ({ many, one }) => ({
    feedback: many(agentFeedback),
    messages: many(conversationMessages),
    reasoningLogs: many(reasoningLogs),
    recommendations: many(aiRecommendations),
    requirements: one(buildRequirements, {
      fields: [conversations.id],
      references: [buildRequirements.conversationId],
    }),
    tasks: many(agentTasks),
    toolCalls: many(agentToolCalls),
  })
);

export const agentToolCallsRelations = relations(agentToolCalls, ({ one }) => ({
  conversation: one(conversations, {
    fields: [agentToolCalls.conversationId],
    references: [conversations.id],
  }),
}));

export const agentTasksRelations = relations(agentTasks, ({ one }) => ({
  conversation: one(conversations, {
    fields: [agentTasks.conversationId],
    references: [conversations.id],
  }),
}));

export const agentFeedbackRelations = relations(agentFeedback, ({ one }) => ({
  conversation: one(conversations, {
    fields: [agentFeedback.conversationId],
    references: [conversations.id],
  }),
  recommendation: one(aiRecommendations, {
    fields: [agentFeedback.recommendationId],
    references: [aiRecommendations.id],
  }),
}));

export const buildRequirementsRelations = relations(
  buildRequirements,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [buildRequirements.conversationId],
      references: [conversations.id],
    }),
  })
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMessages.conversationId],
      references: [conversations.id],
    }),
  })
);

export const aiRecommendationsRelations = relations(
  aiRecommendations,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [aiRecommendations.conversationId],
      references: [conversations.id],
    }),
  })
);

export const reasoningLogsRelations = relations(reasoningLogs, ({ one }) => ({
  conversation: one(conversations, {
    fields: [reasoningLogs.conversationId],
    references: [conversations.id],
  }),
}));
