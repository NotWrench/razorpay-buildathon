import type { NextRequest } from "next/server";
import { buildCatalogResponse } from "@/lib/api/catalog";
import { handleRouteError } from "@/lib/api/respond";

/**
 * GET /store/{slug}/catalog.json
 *
 * The machine-readable catalog, at the address advertised in the agent
 * manifest. No authentication: discovery is meant to be open, and nothing here
 * is private. Buying requires an API key.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/store/[slug]/catalog.json">
): Promise<Response> {
  try {
    const { slug } = await ctx.params;

    return await buildCatalogResponse(slug, request);
  } catch (error) {
    return handleRouteError(error);
  }
}
