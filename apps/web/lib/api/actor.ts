import { auth } from "@workspace/auth";
import type { ApiKeyMetadata } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
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
  /**
   * The one store an API-key caller may trade with.
   *
   * Undefined for people, and for keys issued before scoping existed. Where it
   * is set it is a hard boundary: a key issued by one shop must not be able to
   * order from another, which is the difference between "you are an agent" and
   * "you are *this shop's* agent".
   */
  merchantId?: string;
  /** This key's own spend cap, when the merchant set one. */
  spendCapPaise?: number;
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
      const metadata = (result.key.metadata ?? {}) as ApiKeyMetadata;

      return {
        apiKeyId: result.key.id,
        identifier: result.key.id,
        merchantId: metadata.merchantId,
        spendCapPaise: metadata.spendCapPaise,
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

/**
 * Refuses a buying agent that is reaching into a store it was not issued for.
 *
 * A key carries the one merchant it may trade with, and every entry point that
 * takes a `merchantId` from the caller has to check it — otherwise the id in
 * the request body decides which shop the agent is shopping at, which is the
 * caller choosing their own scope.
 *
 * Keys issued before scoping existed carry no merchant and are left alone: a
 * silent tightening that locks out a counterparty mid-integration is worse
 * than the gap it closes, and `listAgentKeys` shows the merchant which of
 * their keys are unscoped.
 */
export function assertKeyScope(actor: Actor, merchantId: string): void {
  if (actor.type !== "ai_agent" || !actor.merchantId) {
    return;
  }

  if (actor.merchantId !== merchantId) {
    throw new PaymentError(
      "MERCHANT_NOT_FOUND",
      "This key was issued for a different store."
    );
  }
}
