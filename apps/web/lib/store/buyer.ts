import { cookies } from "next/headers";
import { cache } from "react";
import { currentUser } from "@/lib/session";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  isGuestIdentifier,
  newGuestIdentifier,
} from "./guest";

/**
 * Who the cart, the build and the order belong to.
 *
 * `buyerIdentifier` is the same stable identity the agent tools and the money
 * path already use: an email for a signed-in shopper. A guest gets an opaque
 * cookie id instead, so a basket survives a refresh without an account — and
 * because the identifier is the only key the commerce layer filters on, a
 * guest can never reach a signed-in shopper's cart.
 */

export interface Buyer {
  identifier: string;
  isGuest: boolean;
  name: string | null;
  userId: string | null;
}

export const currentBuyer = cache(async (): Promise<Buyer> => {
  const user = await currentUser();

  if (user) {
    return {
      identifier: user.email ?? user.id,
      isGuest: false,
      name: user.name ?? user.email ?? null,
      userId: user.id,
    };
  }

  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;

  // A malformed or hand-edited cookie is replaced rather than trusted; see the
  // note in ./guest.ts about why the format is the check that matters.
  if (isGuestIdentifier(existing)) {
    return { identifier: existing, isGuest: true, name: null, userId: null };
  }

  /*
   * A server component cannot write a cookie, so the id is minted here and
   * only persisted from a server action (see `rememberGuest`). Until then the
   * guest gets a fresh cart per request, which is the correct behaviour for
   * someone who has not yet touched anything.
   */
  return {
    identifier: newGuestIdentifier(),
    isGuest: true,
    name: null,
    userId: null,
  };
});

/** Persists a guest identity. Callable only from a server action or route. */
export async function rememberGuest(identifier: string): Promise<void> {
  const store = await cookies();

  if (store.get(GUEST_COOKIE)?.value === identifier) {
    return;
  }

  store.set(GUEST_COOKIE, identifier, {
    httpOnly: true,
    maxAge: GUEST_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
}

/** The owner shape the commerce layer takes, for one store. */
export async function cartOwner(merchantId: string) {
  const buyer = await currentBuyer();

  return {
    buyerIdentifier: buyer.identifier,
    merchantId,
    userId: buyer.userId,
  };
}
