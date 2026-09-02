import type { Metadata } from "next";
import { ProductsScreen } from "@/components/manager/products-screen";
import { getManagerProducts } from "@/lib/mock";

/** The catalogue as an editing surface. Analysis lives on /manager. */

export const metadata: Metadata = { title: "Products · Manager" };

export default async function ManagerProductsPage() {
  const products = await getManagerProducts();

  return <ProductsScreen products={products} />;
}
