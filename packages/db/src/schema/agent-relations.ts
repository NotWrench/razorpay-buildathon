import { relations } from "drizzle-orm";
import {
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
    messages: many(conversationMessages),
    reasoningLogs: many(reasoningLogs),
    recommendations: many(aiRecommendations),
    requirements: one(buildRequirements, {
      fields: [conversations.id],
      references: [buildRequirements.conversationId],
    }),
  })
);

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
