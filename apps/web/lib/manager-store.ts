import "server-only";

import { db, type Merchant, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { resolveDefaultStore } from "@/lib/data/store";
import { currentUser } from "@/lib/session";

/**
 * Which store the manager's room is allowed to show, and act on.
 *
 * The storefront resolves one shop from the environment, because a shop's own
 * domain has exactly one shop behind it and a signed-out visitor is still a
 * customer. The manager's room cannot work that way. Every screen in it reads
 * revenue and customer identifiers, and after M1 every screen in it can refund
 * an order or take a product off sale — so the store is resolved from *who is
 * asking*, not from the environment, and a caller who owns no store reaches
 * nothing.
 *
 * This is the same rule `assertMerchantOwner` applies to the payment routes.
 * It is stated twice rather than shared because the two entry points fail
 * differently: an API route answers 403, a page has to send somebody to a
 * login screen.
 */

export class NotSignedInError extends Error {
  constructor() {
    super("Sign in to reach the manager.");
    this.name = "NotSignedInError";
  }
}

export class NoOwnedStoreError extends Error {
  constructor() {
    super(
      "This account does not own a store. Seed one with SEED_OWNER_EMAIL set to your address, or sign in as the owner."
    );
    this.name = "NoOwnedStoreError";
  }
}

/**
 * A local-development door, closed by default.
 *
 * The seeded store belongs to `merchant@example.com`, so a developer signed in
 * with their own account owns nothing and would find every manager screen shut
 * — including the ones they are working on. `MANAGER_DEV_OPEN=true` falls back
 * to the default store for a signed-in user who owns none.
 *
 * It is deliberately narrow. It never admits a signed-out caller, it is off
 * unless the variable is exactly "true", and it is read at call time so it
 * cannot be baked into a production build by accident.
 */
function devOpen(): boolean {
  return process.env.MANAGER_DEV_OPEN === "true";
}

/**
 * The store this request may manage.
 *
 * `cache` so the layout, the page and any action in the same request agree on
 * one answer rather than racing three lookups to it.
 */
export const requireManagerStore = cache(async (): Promise<Merchant> => {
  const user = await currentUser();

  if (!user) {
    throw new NotSignedInError();
  }

  const owned = await db.query.merchants.findFirst({
    where: eq(merchants.userId, user.id),
  });

  if (owned) {
    return owned;
  }

  if (devOpen()) {
    const fallback = await resolveDefaultStore();

    if (fallback) {
      return fallback;
    }
  }

  throw new NoOwnedStoreError();
});

/** The merchant id every manager query and every manager write is scoped to. */
export async function managerStoreId(): Promise<string> {
  return (await requireManagerStore()).id;
}

/**
 * The acting merchant, for an audit entry.
 *
 * `actorId` is the user, not the store: two people sharing a shop should not
 * produce an indistinguishable trail.
 */
export async function managerActor(): Promise<{
  actorId: string;
  merchantId: string;
}> {
  const [user, merchant] = await Promise.all([
    currentUser(),
    requireManagerStore(),
  ]);

  return {
    actorId: user?.id ?? merchant.userId ?? merchant.id,
    merchantId: merchant.id,
  };
}
