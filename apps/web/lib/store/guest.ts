/**
 * The guest shopper's identity.
 *
 * Shopping does not require an account, so a signed-out buyer still needs a
 * stable `buyerIdentifier` — it is the only key carts, builds and orders are
 * filtered on. It lives in an httpOnly cookie.
 *
 * The cookie is client-side state, so it is treated as a claim rather than as
 * proof, and the format is the whole defence: a value is accepted only if it
 * is `guest:` followed by a UUID. That is what stops someone setting
 * `buyer_id` to `merchant@example.com` and reading the orders of the account
 * that identifier belongs to. Guessing another guest's UUID is not a practical
 * attack; claiming a *known* identity would have been trivial.
 *
 * The name and the check live here because two different worlds read them —
 * server components through `next/headers`, route handlers through the
 * request — and a validator that existed in only one of them would be a
 * validator the other forgot.
 */

export const GUEST_COOKIE = "buyer_id";

export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const GUEST_IDENTIFIER =
  /^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuestIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && GUEST_IDENTIFIER.test(value);
}

export function newGuestIdentifier(): string {
  return `guest:${crypto.randomUUID()}`;
}
