import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  agentMemoryLong,
  aiRecommendations,
  auditLogs,
  conversationMessages,
  conversations,
  failures,
  reasoningLogs,
} from "./ai";
import { account, apikey, session, user, verification } from "./auth";
import {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";
import {
  accountRelations,
  aiRecommendationsRelations,
  apikeyRelations,
  auditLogsRelations,
  campaignsRelations,
  conversationMessagesRelations,
  conversationsRelations,
  failuresRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productsRelations,
  reasoningLogsRelations,
  sessionRelations,
  userRelations,
} from "./relations";

export {
  agentMemoryLong,
  aiRecommendations,
  auditLogs,
  conversationMessages,
  conversations,
  failures,
  reasoningLogs,
} from "./ai";
// Export individual schemas
export {
  type ApiKeyMetadata,
  account,
  apikey,
  session,
  user,
  verification,
} from "./auth";
export {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";

export {
  accountRelations,
  aiRecommendationsRelations,
  apikeyRelations,
  auditLogsRelations,
  campaignsRelations,
  conversationMessagesRelations,
  conversationsRelations,
  failuresRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productsRelations,
  reasoningLogsRelations,
  sessionRelations,
  userRelations,
} from "./relations";

// Schema aggregation for Drizzle client initialization
export const schema = {
  account,
  accountRelations,
  agentMemoryLong,
  aiRecommendations,
  aiRecommendationsRelations,
  apikey,
  apikeyRelations,
  auditLogs,
  auditLogsRelations,
  campaigns,
  campaignsRelations,
  conversationMessages,
  conversationMessagesRelations,
  conversations,
  conversationsRelations,
  failures,
  failuresRelations,
  merchants,
  merchantsRelations,
  orderItems,
  orderItemsRelations,
  orders,
  ordersRelations,
  payments,
  paymentsRelations,
  products,
  productsRelations,
  reasoningLogs,
  reasoningLogsRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
};

// ==========================================
// Inferred TypeScript Types
// ==========================================

// Auth Types
export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;
export type ApiKey = InferSelectModel<typeof apikey>;
export type NewApiKey = InferInsertModel<typeof apikey>;

// Business Types
export type Merchant = InferSelectModel<typeof merchants>;
export type NewMerchant = InferInsertModel<typeof merchants>;
export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;
export type Campaign = InferSelectModel<typeof campaigns>;
export type NewCampaign = InferInsertModel<typeof campaigns>;

// AI & Telemetry Types
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
