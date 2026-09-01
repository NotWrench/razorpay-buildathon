import { auth } from "@workspace/auth";
import type { NextRequest } from "next/server";
import { GUEST_COOKIE, isGuestIdentifier } from "@/lib/store/guest";

/**
 * Who is calling a payments or agent endpoint.
 *
 * `human` comes from a signed-in better-auth session or from a guest cookie,
 * `ai_agent` from an API key issued to an external agent. Every order carries
 * this distinction so the approval and audit trail can treat agents
 * differently from people.
 */
export interface Actor {
  apiKeyId?: string;
  /** Stable identity written to `orders.buyerIdentifier`. */
  identifier: string;
  /** True when the identity is a guest cookie rather than an account. */
  isGuest?: boolean;
  type: "human" | "ai_agent";
  userId: string | null;
}

const API_KEY_HEADER = "x-api-key";

/**
 * Resolves the caller from an API key, then a session, then a guest cookie.
 *
 * The guest branch is what lets a signed-out shopper use the assistant and the
 * checkout at all — the storefront is deliberately usable without an account,
 * and every tool scopes its reads to this identifier, so a guest sees their own
 * cart, builds and orders and nothing else.
 *
 * The cookie is a claim, not proof, so only the `guest:<uuid>` form is
 * accepted: without that check a client could set `buyer_id` to a known email
 * and read that account's orders. See `lib/store/guest.ts`.
 */
export async function resolveActor(
  request: NextRequest
): Promise<Actor | null> {
  const apiKey = request.headers.get(API_KEY_HEADER);

  if (apiKey) {
    const result = await auth.api.verifyApiKey({ body: { key: apiKey } });

    if (result.valid && result.key) {
      return {
        apiKeyId: result.key.id,
        identifier: result.key.id,
        type: "ai_agent",
        userId: result.key.referenceId ?? null,
      };
    }

    return null;
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (session) {
    return {
      identifier: session.user.email ?? session.user.id,
      type: "human",
      userId: session.user.id,
    };
  }

  const guest = request.cookies.get(GUEST_COOKIE)?.value;

  if (isGuestIdentifier(guest)) {
    return {
      identifier: guest,
      isGuest: true,
      type: "human",
      userId: null,
    };
  }

  return null;
}
