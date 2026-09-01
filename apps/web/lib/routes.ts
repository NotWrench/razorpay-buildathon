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

export const dashboardRoutes = {
  assistant: route("/dashboard/assistant"),
  insights: route("/dashboard/insights"),
  inventory: route("/dashboard/inventory"),
  orders: route("/dashboard/orders"),
  overview: route("/dashboard"),
  products: route("/dashboard/products"),
};
