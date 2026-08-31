import { auth } from "@workspace/auth";
import type { NextRequest } from "next/server";

/**
 * Who is calling a payments endpoint.
 *
 * `human` comes from a signed-in better-auth session, `ai_agent` from an API
 * key issued to an external agent. Every order carries this distinction so the
 * approval and audit trail can treat agents differently from people.
 */
export interface Actor {
  apiKeyId?: string;
  /** Stable identity written to `orders.buyerIdentifier`. */
  identifier: string;
  type: "human" | "ai_agent";
  userId: string | null;
}

const API_KEY_HEADER = "x-api-key";

/** Resolves the caller from an API key first, then a session cookie. */
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

  if (!session) {
    return null;
  }

  return {
    identifier: session.user.email ?? session.user.id,
    type: "human",
    userId: session.user.id,
  };
}
