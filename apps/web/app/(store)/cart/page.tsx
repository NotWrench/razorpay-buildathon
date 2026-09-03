import type { Metadata } from "next";
import { CartScreen } from "@/components/cart/cart-screen";
import { getCart } from "@/lib/data";

/**
 * The cart. Fetched on the server, edited on the client — the shapes match
 * `lib/actions/cart.ts` so the real mutations drop in later without the screen
 * changing.
 */

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const cart = await getCart();

  return <CartScreen cart={cart} />;
}
