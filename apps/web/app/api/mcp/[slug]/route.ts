import {
  buildMerchantContext,
  buildStorefrontContext,
  getMerchantBySlug,
} from "@workspace/ai";
import { handleMcpRequest, type McpScope } from "@workspace/mcp";
import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/api/actor";
import { toAgentActor } from "@/lib/api/agent";
import { isMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, unauthorized } from "@/lib/api/respond";

export const maxDuration = 30;

/**
 * POST /api/mcp/[slug]
 *
 * The store's domain capabilities over MCP (§17).
 *
 * This route does one job that matters: it decides the caller's scope, from
 * the server's own view of who they are, and hands that to the MCP layer. The
 * scope is never read from the body, a header the caller controls, or a
 * capability argument — an MCP client that asks for merchant access gets
 * whatever it was already entitled to.
 *
 * The split follows §20's existing rule rather than inventing a second one:
 * `isMerchantOwner` is the same check the payments routes use, and it already
 * refuses API-key callers as merchants because an API key is issued to a
 * buying agent, never to a shop owner.
 *
 * Everything downstream is unchanged. Capabilities delegate to the same tools
 * the in-app agent calls, with the same context, so an MCP caller has exactly
 * the reach of a chat session with the same identity — no more.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { slug } = await params;
    const merchant = await getMerchantBySlug(slug);

    // Server-decided, from the session or key that reached us.
    const scope: McpScope = (await isMerchantOwner(actor, merchant.id))
      ? "merchant"
      : "customer";

    const agentActor = toAgentActor(actor);

    // The merchant context carries the owner's identity; the storefront one
    // carries the buyer's. Either way the identity comes from the request.
    const ctx =
      scope === "merchant"
        ? await buildMerchantContext({
            actor: agentActor,
            merchantId: merchant.id,
          })
        : await buildStorefrontContext({ actor: agentActor, slug });

    return await handleMcpRequest(
      { ctx, scope, storeName: merchant.businessName },
      request
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * The transport answers GET with a 405 in stateless mode, which is correct:
 * there is no session to resume and no server-initiated stream to open.
 */
export function GET(): Response {
  return new Response(
    JSON.stringify({
      error: "This MCP endpoint is stateless. Use POST.",
    }),
    {
      headers: { "content-type": "application/json" },
      status: 405,
    }
  );
}
