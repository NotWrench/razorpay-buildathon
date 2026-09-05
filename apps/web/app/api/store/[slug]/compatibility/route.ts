import { getMerchantBySlug } from "@workspace/ai";
import { BuildError, loadBuildComponents } from "@workspace/commerce/builds";
import { validateBuild } from "@workspace/commerce/compatibility";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleRouteError } from "@/lib/api/respond";

/**
 * POST /api/store/{slug}/compatibility
 *
 * Whether a set of this store's parts works together.
 *
 * The engine has existed since the build surface did, and reached the in-app
 * agent and MCP callers — but not the REST buyer the discovery manifest points
 * at. So an external agent could read a catalog full of sockets and form
 * factors and had no way to ask the question those fields exist to answer.
 *
 * **Public, like the catalog.** It reads specifications that are already
 * published in `catalog.json` and runs a pure function over them; it writes
 * nothing, reveals nothing about any buyer, and costs one indexed query. An
 * agent deciding whether this merchant is worth engaging should be able to find
 * that out before it holds a credential — requiring a key here would mean
 * issuing one to answer a question the catalog has already answered in pieces.
 *
 * **Deterministic, not a model.** `validateBuild` is a set of pure rules over
 * typed columns. It returns a status per rule and — the part that matters —
 * `insufficient_data` where an input is null, which is never folded into
 * `compatible`. A buying agent should be able to tell "we checked and it fits"
 * from "we could not check", because only one of those is safe to act on.
 */

export const maxDuration = 15;

/** The same twenty-line bound the cart and the builder tool already use. */
const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(10).default(1),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/store/[slug]/compatibility">
): Promise<Response> {
  try {
    const { slug } = await ctx.params;
    const merchant = await getMerchantBySlug(slug);
    const { items } = bodySchema.parse(await request.json());

    const components = await loadBuildComponents(merchant.id, items);
    const validation = validateBuild(components);

    return Response.json(
      {
        data: {
          canCheckout: validation.canCheckout,
          estimatedWattage: validation.estimatedWattage,
          issues: validation.issues,
          /*
           * Restated on every response rather than documented once. The single
           * most expensive mistake a calling agent can make here is reading
           * `insufficient_data` as a pass, and the answer is the only place it
           * is certain to look.
           */
          note: "insufficient_data means a specification this rule reads is null — not that the parts are fine. Only `blocking` severity stops a checkout.",
          recommendedPsuWattage: validation.recommendedPsuWattage,
          slotsUsed: validation.slotsUsed,
          status: validation.status,
        },
        success: true,
      },
      {
        headers: {
          /*
           * The answer is a pure function of specs that change rarely, but it
           * is a POST, so this is a hint for an agent that caches by body
           * rather than a directive to a shared cache.
           */
          "cache-control": "private, max-age=60",
        },
      }
    );
  } catch (error) {
    /*
     * A product that is not this store's, or has no category to occupy a slot,
     * is the caller's mistake and should read as one — not as a 500.
     */
    if (error instanceof BuildError) {
      return fail(error.code, error.message, 422);
    }

    return handleRouteError(error);
  }
}
