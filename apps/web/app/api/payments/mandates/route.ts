import { getMerchantBySlug } from "@workspace/ai";
import { establishMandate, findMandate } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * The buyer's side of the counter.
 *
 * A merchant issues an API key at `/manager/agents` that says which store a
 * counterparty may trade with and for how much. This is the same act, from the
 * other direction: the buyer saying which store may charge them, up to what per
 * order, up to what in total, and until when.
 *
 * The token fields are optional and, when present, are what turns a mandate
 * from `simulated` into `recurring` — they come back from a Razorpay checkout
 * opened with `recurring: 1`. `establishMandate` derives the instrument from
 * them rather than accepting one, so a tokenless mandate cannot be labelled
 * chargeable and fail at the moment money is meant to move.
 */
const bodySchema = z.object({
  buyerContact: z.string().max(20).optional(),
  buyerEmail: z.email().optional(),
  /** How long the authority lasts. Bounded so "forever" is not reachable. */
  days: z.number().int().min(1).max(365).default(30),
  maxPerOrderPaise: z.number().int().min(100).max(50_000_000),
  maxTotalPaise: z.number().int().min(100).max(50_000_000),
  razorpayCustomerId: z.string().max(64).optional(),
  razorpayTokenId: z.string().max(64).optional(),
  slug: z.string().min(1).max(120),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /api/payments/mandates?slug=… — this buyer's live authorisation, if any. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const slug = request.nextUrl.searchParams.get("slug");

    if (!slug) {
      return ok({ mandate: null });
    }

    const merchant = await getMerchantBySlug(slug);
    const mandate = await findMandate({
      buyerIdentifier: actor.identifier,
      merchantId: merchant.id,
    });

    return ok({ mandate });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/payments/mandates — authorise this store to charge unattended. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());
    const merchant = await getMerchantBySlug(body.slug);

    const mandate = await establishMandate({
      buyerContact: body.buyerContact,
      /*
       * The identifier is an email for a signed-in shopper, which is what
       * Razorpay wants anyway. It is never taken from the body: a caller who
       * could name the buyer could authorise spending on somebody else.
       */
      buyerEmail:
        body.buyerEmail ??
        (actor.type === "human" ? actor.identifier : undefined),
      buyerIdentifier: actor.identifier,
      expiresAt: new Date(Date.now() + body.days * DAY_MS),
      maxPerOrderPaise: body.maxPerOrderPaise,
      maxTotalPaise: body.maxTotalPaise,
      merchantId: merchant.id,
      razorpayCustomerId: body.razorpayCustomerId,
      razorpayTokenId: body.razorpayTokenId,
      userId: actor.userId,
    });

    return ok({ mandate }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
