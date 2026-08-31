import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { account, apikey, session, user, verification } from "./auth";
import { buildItems, builds } from "./builds";
import {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";
import { productCategories } from "./catalog";
import { inventory } from "./inventory";
import {
  accountRelations,
  apikeyRelations,
  buildItemsRelations,
  buildsRelations,
  campaignsRelations,
  inventoryRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productCategoriesRelations,
  productSpecsRelations,
  productsRelations,
  sessionRelations,
  userRelations,
} from "./relations";
import { productSpecs } from "./specs";

/**
 * The project database (`razorpay_project`): auth and business data.
 *
 * This module is the schema entry point for `drizzle.config.ts`, so anything
 * exported here becomes a table in that database — and, just as importantly,
 * the agent tables are absent so they are not created here.
 */

export {
  type ApiKeyMetadata,
  account,
  apikey,
  session,
  user,
  verification,
} from "./auth";
export { buildItems, builds } from "./builds";
export {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  products,
} from "./business";

export { productCategories } from "./catalog";
export { inventory } from "./inventory";
export {
  accountRelations,
  apikeyRelations,
  buildItemsRelations,
  buildsRelations,
  campaignsRelations,
  inventoryRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productCategoriesRelations,
  productSpecsRelations,
  productsRelations,
  sessionRelations,
  userRelations,
} from "./relations";

export { type PciePowerConnector, productSpecs } from "./specs";

/** Aggregation passed to `drizzle()` for the project client. */
export const projectSchema = {
  account,
  accountRelations,
  apikey,
  apikeyRelations,
  buildItems,
  buildItemsRelations,
  builds,
  buildsRelations,
  campaigns,
  campaignsRelations,
  inventory,
  inventoryRelations,
  merchants,
  merchantsRelations,
  orderItems,
  orderItemsRelations,
  orders,
  ordersRelations,
  payments,
  paymentsRelations,
  productCategories,
  productCategoriesRelations,
  productSpecs,
  productSpecsRelations,
  products,
  productsRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
};

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

export type Build = InferSelectModel<typeof builds>;
export type NewBuild = InferInsertModel<typeof builds>;
export type BuildItem = InferSelectModel<typeof buildItems>;
export type NewBuildItem = InferInsertModel<typeof buildItems>;

export type Merchant = InferSelectModel<typeof merchants>;
export type NewMerchant = InferInsertModel<typeof merchants>;
export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
export type ProductCategory = InferSelectModel<typeof productCategories>;
export type NewProductCategory = InferInsertModel<typeof productCategories>;
export type Inventory = InferSelectModel<typeof inventory>;
export type NewInventory = InferInsertModel<typeof inventory>;
export type ProductSpec = InferSelectModel<typeof productSpecs>;
export type NewProductSpec = InferInsertModel<typeof productSpecs>;
export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;
export type Campaign = InferSelectModel<typeof campaigns>;
export type NewCampaign = InferInsertModel<typeof campaigns>;
