import { relations } from "drizzle-orm";
import {
  aiRecommendations,
  auditLogs,
  conversationMessages,
  conversations,
  failures,
  reasoningLogs,
} from "./ai";
import { account, apikey, session, user } from "./auth";
import {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  apikeys: many(apikey),
  merchants: many(merchants),
  orders: many(orders),
  sessions: many(session),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
  }),
}));

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  auditLogs: many(auditLogs),
  campaigns: many(campaigns),
  conversations: many(conversations),
  orders: many(orders),
  products: many(products),
  user: one(user, {
    fields: [merchants.userId],
    references: [user.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  aiRecommendations: many(aiRecommendations),
  merchant: one(merchants, {
    fields: [products.merchantId],
    references: [merchants.id],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  auditLogs: many(auditLogs),
  failures: many(failures),
  items: many(orderItems),
  merchant: one(merchants, {
    fields: [orders.merchantId],
    references: [merchants.id],
  }),
  payments: many(payments),
  user: one(user, {
    fields: [orders.userId],
    references: [user.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  merchant: one(merchants, {
    fields: [campaigns.merchantId],
    references: [merchants.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    merchant: one(merchants, {
      fields: [conversations.merchantId],
      references: [merchants.id],
    }),
    messages: many(conversationMessages),
    reasoningLogs: many(reasoningLogs),
    recommendations: many(aiRecommendations),
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
    product: one(products, {
      fields: [aiRecommendations.productId],
      references: [products.id],
    }),
  })
);

export const reasoningLogsRelations = relations(reasoningLogs, ({ one }) => ({
  conversation: one(conversations, {
    fields: [reasoningLogs.conversationId],
    references: [conversations.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  merchant: one(merchants, {
    fields: [auditLogs.merchantId],
    references: [merchants.id],
  }),
  order: one(orders, {
    fields: [auditLogs.orderId],
    references: [orders.id],
  }),
}));

export const failuresRelations = relations(failures, ({ one }) => ({
  order: one(orders, {
    fields: [failures.orderId],
    references: [orders.id],
  }),
}));
