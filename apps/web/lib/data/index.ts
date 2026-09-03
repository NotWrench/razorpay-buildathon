/**
 * The storefront's read layer.
 *
 * Every screen in the v3 storefront and the manager reads from here. The
 * functions have the shapes the fixtures used to have — that was the point of
 * building against a contract — but each one now runs a query against the
 * store's own data, scoped to the merchant `./store.ts` resolves and, where it
 * matters, to the buyer `lib/store/buyer.ts` identifies.
 *
 * Two rules hold across the whole module:
 *
 * 1. **Nothing invented.** Where the database has no answer — page views,
 *    fulfilment state, an address book — the surface says so or asks a
 *    different question it can actually answer, rather than filling the gap.
 * 2. **Reads only.** Mutations are server actions in `lib/actions/`, and the
 *    money path is `@workspace/payments`. Nothing in here writes a row.
 */

export { getAccount, orderRef } from "./account";
export { countCart, getCart, openCartId } from "./cart";
export type { CatalogPage, CatalogQuery, Facet, ProductSort } from "./catalog";
export { getCatalog, PRODUCT_SORTS, SORT_LABELS } from "./catalog";
export {
  fitsOpenBuild,
  openBuild,
  reportFor,
  reportForProduct,
} from "./compatibility";
export {
  getManagerOrders,
  getManagerProducts,
  getManagerSummary,
  getRestock,
  getStoreSettings,
  MANAGER_RANGES,
} from "./manager";
export { getPrebuilt, getPrebuilts } from "./prebuilts";
export {
  getProduct,
  getProducts,
  getProductsByIds,
  isUuid,
  searchIdle,
  searchQuery,
  stockState,
} from "./product";
export {
  NoStoreError,
  requireDefaultStore,
  resolveDefaultStore,
  storeId,
  storeSlug,
} from "./store";
export type * from "./types";
