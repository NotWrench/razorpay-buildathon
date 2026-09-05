import { db, merchants } from "@workspace/db";
import {
  assertTestMode,
  createRazorpayClient,
  isTestKeyId,
  PaymentError,
  toPaymentError,
} from "@workspace/payments";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * Razorpay stamps the mode into the key id, so the pair is the whole
 * declaration: there is no separate "test mode" flag to set, and no way for
 * one to drift out of step with the keys it describes.
 *
 * Which is also why an `rzp_live_` key is refused below while the build runs
 * in test mode: nothing downstream could tell the difference afterwards, and
 * the first thing to notice would be a real charge.
 */
const KEY_PATTERN = /^rzp_(live|test)_[A-Za-z0-9]+$/;

const bodySchema = z.object({
  keyId: z
    .string()
    .min(12)
    .max(120)
    .regex(
      KEY_PATTERN,
      "A Razorpay key id looks like rzp_test_xxxxxxxxxxxx or rzp_live_xxxxxxxxxxxx"
    ),
  keySecret: z.string().min(8).max(200),
  merchantId: z.uuid(),
});

/**
 * Asks Razorpay whether the pair is real, before it is written down.
 *
 * `orders.all` is the cheapest authenticated read the API offers, and a 401
 * from it is the only reliable way to tell a working key from a typo. Without
 * this the store would accept bad credentials happily and only fail at the
 * next checkout — by which point the person who typed them is gone and the
 * symptom is "payments are broken".
 *
 * Returns the refusal rather than throwing it, so the original SDK error stays
 * attached as `details` on the error the caller raises instead of being
 * flattened into a message here.
 */
async function credentialRefusal(
  keyId: string,
  keySecret: string
): Promise<PaymentError | null> {
  try {
    await createRazorpayClient({ keyId, keySecret }).orders.all({ count: 1 });

    return null;
  } catch (error) {
    return toPaymentError(error);
  }
}

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

    assertTestMode(body.keyId, "That key id");

    const refusal = await credentialRefusal(body.keyId, body.keySecret);

    if (refusal) {
      throw new PaymentError(
        "MERCHANT_NOT_CONNECTED",
        `Razorpay refused those credentials: ${refusal.message}`,
        refusal.details
      );
    }

    await db
      .update(merchants)
      .set({ razorpayKeyId: body.keyId, razorpayKeySecret: body.keySecret })
      .where(eq(merchants.id, body.merchantId));

    return ok({
      connected: true,
      keyId: body.keyId,
      mode: isTestKeyId(body.keyId) ? "test" : "live",
    });
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
