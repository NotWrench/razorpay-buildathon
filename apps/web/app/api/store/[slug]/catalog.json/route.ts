import type { NextRequest } from "next/server";
import { buildCatalogResponse } from "@/lib/api/catalog";
import { handleRouteError } from "@/lib/api/respond";

/**
 * GET /api/store/{slug}/catalog.json
 *
 * The api-prefixed twin of `/store/{slug}/catalog.json`, for buyers that
 * assume every endpoint lives under /api. Same handler, same bytes.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/store/[slug]/catalog.json">
): Promise<Response> {
  try {
    const { slug } = await ctx.params;

    return await buildCatalogResponse(slug, request);
  } catch (error) {
    return handleRouteError(error);
  }
}
