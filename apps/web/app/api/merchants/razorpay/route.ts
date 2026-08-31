import { db, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  keyId: z.string().min(8).max(120).startsWith("rzp_"),
  keySecret: z.string().min(8).max(200),
  merchantId: z.uuid(),
});

/**
 * PUT /api/merchants/razorpay
 *
 * Connects a merchant's own Razorpay account. Everything downstream already
 * prefers these credentials and falls back to the platform keys
 * (`resolveMerchantCredentials`), so connecting is the only step needed for a
 * store to be billed through its own account.
 *
 * The secret is write-only over this API: it is never returned by any endpoint.
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    await db
      .update(merchants)
      .set({ razorpayKeyId: body.keyId, razorpayKeySecret: body.keySecret })
      .where(eq(merchants.id, body.merchantId));

    return ok({ connected: true, keyId: body.keyId });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** DELETE /api/merchants/razorpay — revert to the platform account. */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const merchantId = new URL(request.url).searchParams.get("merchantId");

    if (!merchantId) {
      return ok({ connected: false });
    }

    await assertMerchantOwner(actor, merchantId);

    await db
      .update(merchants)
      .set({ razorpayKeyId: null, razorpayKeySecret: null })
      .where(eq(merchants.id, merchantId));

    return ok({ connected: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
