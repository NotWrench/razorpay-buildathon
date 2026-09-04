import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { account, apikey, session, user, verification } from "./auth";
import { buildItems, builds } from "./builds";
import {
  campaigns,
  merchants,
  orderItems,
  orders,
  payments,
  productPriceHistory,
  products,
} from "./business";
import { cartItems, carts } from "./carts";
import { productCategories } from "./catalog";
import { inventory } from "./inventory";
import {
  accountRelations,
  apikeyRelations,
  buildItemsRelations,
  buildsRelations,
  campaignsRelations,
  cartItemsRelations,
  cartsRelations,
  inventoryRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productCategoriesRelations,
  productSpecsRelations,
  productsRelations,
  reorderRequestsRelations,
  sessionRelations,
  userRelations,
} from "./relations";
import { reorderRequests } from "./reorders";
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
  productPriceHistory,
  products,
} from "./business";

export { cartItems, carts } from "./carts";

export { productCategories } from "./catalog";
export { inventory } from "./inventory";
export {
  accountRelations,
  apikeyRelations,
  buildItemsRelations,
  buildsRelations,
  campaignsRelations,
  cartItemsRelations,
  cartsRelations,
  inventoryRelations,
  merchantsRelations,
  orderItemsRelations,
  ordersRelations,
  paymentsRelations,
  productCategoriesRelations,
  productSpecsRelations,
  productsRelations,
  reorderRequestsRelations,
  sessionRelations,
  userRelations,
} from "./relations";

export { reorderRequests } from "./reorders";

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
  cartItems,
  cartItemsRelations,
  carts,
  cartsRelations,
  inventory,
  inventoryRelations,
  merchants,
  merchantsRelations,
  orderItems,
  orderItemsRelations,
  orders,
  productPriceHistory,
  ordersRelations,
  payments,
  paymentsRelations,
  productCategories,
  productCategoriesRelations,
  productSpecs,
  productSpecsRelations,
  products,
  productsRelations,
  reorderRequests,
  reorderRequestsRelations,
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

export type Cart = InferSelectModel<typeof carts>;
export type NewCart = InferInsertModel<typeof carts>;
export type CartItem = InferSelectModel<typeof cartItems>;
export type NewCartItem = InferInsertModel<typeof cartItems>;

export type Merchant = InferSelectModel<typeof merchants>;
export type NewMerchant = InferInsertModel<typeof merchants>;
export type Product = InferSelectModel<typeof products>;
export type ProductPriceChange = InferSelectModel<typeof productPriceHistory>;
export type NewProduct = InferInsertModel<typeof products>;
export type ProductCategory = InferSelectModel<typeof productCategories>;
export type NewProductCategory = InferInsertModel<typeof productCategories>;
export type Inventory = InferSelectModel<typeof inventory>;
export type NewInventory = InferInsertModel<typeof inventory>;
export type ReorderRequest = InferSelectModel<typeof reorderRequests>;
export type NewReorderRequest = InferInsertModel<typeof reorderRequests>;
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
