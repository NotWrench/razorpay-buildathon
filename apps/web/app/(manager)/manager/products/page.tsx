import type { Metadata } from "next";
import { ProductsScreen } from "@/components/manager/products-screen";
import { getManagerProducts } from "@/lib/data";

/** The catalogue as an editing surface. Analysis lives on /manager. */

/**
 * Operational data, read on every request.
 *
 * Nothing on this page takes a cookie or a search param, so Next would
 * otherwise prerender it at build time and serve a stock count from whenever
 * the deploy happened. A manager screen that is quietly hours out of date is
 * worse than a slow one.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Products · Manager" };

export default async function ManagerProductsPage() {
  const products = await getManagerProducts();

  return <ProductsScreen products={products} />;
}
