import { timingSafeEqual } from "node:crypto";
import {
  buildMerchantContext,
  hasModelCredentials,
  runMerchantBriefing,
} from "@workspace/ai";
import { db, merchants } from "@workspace/db";
import type { NextRequest } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api/respond";

/**
 * GET /api/cron/briefing
 *
 * The overnight run, for a deployment that has a scheduler but no shell.
 * `vercel.json` points a nightly cron here; `scripts/nightly.ts` does the same
 * thing locally.
 *
 * **Why a shared secret and not a session.** The interactive route at
 * `/api/agent/merchant/briefing` authenticates the merchant, which is right —
 * a person asking for their own briefing should be a person. A scheduler is
 * not a person and has no session to hold, so it carries a secret this
 * deployment set, and the run then acts *as each store's owner* so the audit
 * trail still names somebody rather than a service account.
 *
 * The secret is compared in constant time and the route refuses to run at all
 * when it is unset — a cron endpoint that is open when misconfigured is worse
 * than one that is broken, because nothing tells you.
 *
 * Nothing it can do moves money. Every money tool suspends for an approval
 * nobody is here to give; see `agents/briefing.ts`.
 */

export const maxDuration = 300;

/** One store's result, success or otherwise. The run reports both. */
interface BriefingOutcome {
  blockedTools?: string[];
  draftedCampaigns?: number;
  error?: string;
  ok: boolean;
  raisedReorders?: number;
  slug: string;
}

/** Constant-time, and false on any length mismatch rather than throwing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const expected = process.env.CRON_SECRET;

    if (!expected) {
      return fail(
        "CRON_NOT_CONFIGURED",
        "CRON_SECRET is not set, so scheduled briefings are disabled",
        503
      );
    }

    /*
     * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The header is
     * the only accepted place: a secret in a query string ends up in access
     * logs and in anything that mirrors a URL.
     */
    const header = request.headers.get("authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!secretMatches(provided, expected)) {
      return fail("UNAUTHORIZED", "Bad or missing cron credential", 401);
    }

    if (!hasModelCredentials()) {
      return fail(
        "MODEL_NOT_CONFIGURED",
        "Set a model provider key to run the briefing",
        503
      );
    }

    const stores = await db.select().from(merchants);

    const results: BriefingOutcome[] = [];

    /*
     * Sequential on purpose. Each briefing is a multi-step model run, and a
     * provider that rate-limits by the minute answers a parallel fan-out with
     * 429s — so the fast version briefs no one. Stores are few and the window
     * is a whole night.
     */
    for (const store of stores) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose, see above
        const ctx = await buildMerchantContext({
          actor: {
            identifier: store.userId,
            type: "human",
            userId: store.userId,
          },
          merchantId: store.id,
        });

        const result = await runMerchantBriefing(ctx);

        results.push({
          blockedTools: result.blockedTools,
          draftedCampaigns: result.draftedCampaigns,
          ok: true,
          raisedReorders: result.raisedReorders,
          slug: store.storeSlug,
        });
      } catch (error) {
        // One store's bad run must not stop the others.
        results.push({
          error: (error as Error).message,
          ok: false,
          slug: store.storeSlug,
        });
      }
    }

    return ok({ briefed: results.length, results });
  } catch (error) {
    return handleRouteError(error);
  }
}
