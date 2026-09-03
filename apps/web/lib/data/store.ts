import { db, type Merchant, merchants } from "@workspace/db";
import { asc } from "drizzle-orm";
import { cache } from "react";

/**
 * Which store the unslugged storefront is.
 *
 * `/store/[slug]` carries its merchant in the URL. The v3 surfaces — `/shop`,
 * `/product/[id]`, `/cart`, `/manager` — do not: they are the storefront of
 * one shop, the way a shop's own domain is. So the merchant is resolved once,
 * here, from `AI_BUYER_STORE_SLUG` if it names a real store and otherwise from
 * the oldest row.
 *
 * The fallback matters more than it looks. A developer with a fresh database
 * and no env var still gets a working storefront rather than a wall of 500s,
 * and a deployment that means a *particular* store says so in the env rather
 * than depending on insertion order.
 */

export class NoStoreError extends Error {
  constructor() {
    super(
      "No merchant exists yet. Run `bun run seed` to create the demo store."
    );
    this.name = "NoStoreError";
  }
}

export const resolveDefaultStore = cache(async (): Promise<Merchant | null> => {
  const slug = process.env.AI_BUYER_STORE_SLUG?.trim();

  if (slug) {
    const named = await db.query.merchants.findFirst({
      where: (row, { eq }) => eq(row.storeSlug, slug),
    });

    if (named) {
      return named;
    }
  }

  const [oldest] = await db
    .select()
    .from(merchants)
    .orderBy(asc(merchants.createdAt))
    .limit(1);

  return oldest ?? null;
});

/**
 * The same lookup for callers that cannot render without one.
 *
 * Throws rather than returning null so a page never renders a half-empty shop
 * that looks like the catalogue is out of stock. `app/(store)/error.tsx` turns
 * it into a sentence a developer can act on.
 */
export async function requireDefaultStore(): Promise<Merchant> {
  const merchant = await resolveDefaultStore();

  if (!merchant) {
    throw new NoStoreError();
  }

  return merchant;
}

/** The merchant id every query below is scoped to. */
export async function storeId(): Promise<string> {
  return (await requireDefaultStore()).id;
}

/** The slug the slug-scoped server actions and the agent endpoints take. */
export async function storeSlug(): Promise<string> {
  return (await requireDefaultStore()).storeSlug;
}
