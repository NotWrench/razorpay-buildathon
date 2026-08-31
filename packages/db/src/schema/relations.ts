import { relations } from "drizzle-orm";
import { account, apikey, session, user } from "./auth";
import {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";
import { productCategories } from "./catalog";
import { productSpecs } from "./specs";

/**
 * Relations inside the project database.
 *
 * The agent tables used to appear here — merchants had `conversations` and
 * `auditLogs`, orders had `failures`. Those links now cross a database
 * boundary and live in `agent-relations.ts` where they still make sense, or
 * are resolved with a second query where they do not.
 */

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

export const productCategoriesRelations = relations(
  productCategories,
  ({ one, many }) => ({
    merchant: one(merchants, {
      fields: [productCategories.merchantId],
      references: [merchants.id],
    }),
    products: many(products),
  })
);

export const productSpecsRelations = relations(productSpecs, ({ one }) => ({
  merchant: one(merchants, {
    fields: [productSpecs.merchantId],
    references: [merchants.id],
  }),
  product: one(products, {
    fields: [productSpecs.productId],
    references: [products.id],
  }),
}));

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  campaigns: many(campaigns),
  orders: many(orders),
  productCategories: many(productCategories),
  productSpecs: many(productSpecs),
  products: many(products),
  user: one(user, {
    fields: [merchants.userId],
    references: [user.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  merchant: one(merchants, {
    fields: [products.merchantId],
    references: [merchants.id],
  }),
  orderItems: many(orderItems),
  specs: one(productSpecs, {
    fields: [products.id],
    references: [productSpecs.productId],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
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
