import { type NextRequest, NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  isGuestIdentifier,
  newGuestIdentifier,
} from "@/lib/store/guest";

/**
 * Gives a signed-out shopper an identity before they need one.
 *
 * The storefront is usable without an account, and everything that persists
 * for a buyer — cart, builds, orders, and the agent's view of all three — is
 * keyed on `buyerIdentifier`. A server component cannot write a cookie, so
 * without this the identity would only be minted by the first mutation, and
 * anything that reads before writing (the assistant's first turn, most of all)
 * would arrive with no identity and be refused.
 *
 * Minting it here means the id exists from the first page view, and the same
 * request already sees it: the cookie is written onto the forwarded request as
 * well as the response, so the render underneath resolves the identity the
 * browser is about to be given rather than a second one.
 *
 * A signed-in shopper is unaffected — the session wins wherever the buyer is
 * resolved, and this cookie is simply ignored.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(GUEST_COOKIE)?.value;

  if (isGuestIdentifier(existing)) {
    return NextResponse.next();
  }

  const identifier = newGuestIdentifier();

  request.cookies.set(GUEST_COOKIE, identifier);

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  response.cookies.set(GUEST_COOKIE, identifier, {
    httpOnly: true,
    maxAge: GUEST_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/store/:path*", "/api/agent/:path*"],
};
