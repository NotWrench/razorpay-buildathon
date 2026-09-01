import { getMerchantBySlug } from "@workspace/ai";
import type { Merchant } from "@workspace/db";
import { notFound } from "next/navigation";
import { cache } from "react";

/**
 * The store a storefront page is being rendered for.
 *
 * Every storefront route is scoped by slug, and every query underneath takes a
 * `merchantId` from here rather than from anything the client sent. Wrapped in
 * `cache` so a layout, a page and a server action in the same request resolve
 * the store once.
 */
export const resolveStore = cache(
  async (slug: string): Promise<Merchant | null> => {
    try {
      return await getMerchantBySlug(slug);
    } catch {
      return null;
    }
  }
);

/** The same lookup, for routes that cannot render without a store. */
export async function requireStore(slug: string): Promise<Merchant> {
  const merchant = await resolveStore(slug);

  if (!merchant) {
    notFound();
  }

  return merchant;
}
