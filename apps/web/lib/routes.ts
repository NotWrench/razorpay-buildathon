import type { Route } from "next";

/**
 * Route strings the typed-routes checker accepts.
 *
 * `typedRoutes` proves a literal href against the generated route map, which
 * is exactly what you want for a hand-written link and exactly what it cannot
 * do for one assembled at runtime from a slug or a nav table. Rather than
 * scattering casts through the components, every computed path is built here
 * from the same segment names the `app/` tree uses — so a renamed route breaks
 * one file instead of failing silently in fifteen.
 */

/** Asserts a runtime-built path is a real route. Use the builders below first. */
export function route(path: string): Route {
  return path as Route;
}

export const storeRoutes = (slug: string) => ({
  assistant: route(`/store/${slug}/assistant`),
  build: route(`/store/${slug}/build`),
  buildWith: (buildId: string) =>
    route(`/store/${slug}/build?buildId=${buildId}`),
  cart: route(`/store/${slug}/cart`),
  home: route(`/store/${slug}`),
  order: (orderId: string) => route(`/store/${slug}/orders/${orderId}`),
  orders: route(`/store/${slug}/orders`),
  product: (productId: string) => route(`/store/${slug}/products/${productId}`),
  products: route(`/store/${slug}/products`),
  productsInCategory: (category: string) =>
    route(`/store/${slug}/products?category=${encodeURIComponent(category)}`),
  search: (query: string) =>
    route(`/store/${slug}/products?q=${encodeURIComponent(query)}`),
});

/**
 * The manager side.
 *
 * `/manager` IS the assistant — there is no separate dashboard, because a
 * dashboard would only repeat, worse, what the summary already says. The other
 * four are editing surfaces.
 */
export const managerRoutes = {
  account: route("/manager/account"),
  activity: route("/manager/activity"),
  agents: route("/manager/agents"),
  assistant: route("/manager"),
  assistantWith: (rangeId: string) => route(`/manager?range=${rangeId}`),
  campaigns: route("/manager/campaigns"),
  orders: route("/manager/orders"),
  products: route("/manager/products"),
  restock: route("/manager/restock"),
};

/**
 * The v3 storefront's routes.
 *
 * Most of these are still a prompt away from existing, so they go through
 * `route()` — the nav is written once, here, and the day a page lands the
 * literal already matches.
 */
export const shellRoutes = {
  about: route("/about"),
  account: route("/account"),
  accountSettings: route("/account/settings"),
  assistant: route("/assistant"),
  assistantWith: (query: string) =>
    route(`/assistant?q=${encodeURIComponent(query)}`),
  build: route("/build"),
  /**
   * Use cases select machines, not parts: the four values here are the
   * ones /prebuilts already matches on, and components carry no use-case
   * dimension in the data to filter by.
   */
  byUse: (useCase: string) =>
    route(`/prebuilts?use=${encodeURIComponent(useCase)}`),
  cart: route("/cart"),
  checkout: route("/checkout"),
  /** Checkout for a build the assistant assembled, rather than the cart. */
  checkoutWith: (productIds: string[]) =>
    route(`/checkout?parts=${encodeURIComponent(productIds.join(","))}`),
  components: route("/shop"),
  contact: route("/contact"),
  /** One saved thread, reopened. */
  conversation: (id: string) => route(`/assistant?c=${encodeURIComponent(id)}`),
  home: route("/"),
  login: route("/login"),
  prebuilt: (slug: string) => route(`/prebuilts/${slug}`),
  prebuiltSpecs: (slug: string) => route(`/prebuilts/${slug}#specs`),
  prebuilts: route("/prebuilts"),
  preview: route("/preview"),
  product: (id: string) => route(`/product/${id}`),
  search: (query: string) => route(`/shop?q=${encodeURIComponent(query)}`),
  shipping: route("/shipping"),
  shopCategory: (category: string) => route(`/shop/${category}`),
  signup: route("/signup"),
  warranty: route("/warranty"),
};
