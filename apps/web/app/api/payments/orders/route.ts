import { quoteForMerchant } from "@workspace/ai";
import { createCheckoutOrder } from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { assertKeyScope, resolveActor } from "@/lib/api/actor";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  /** Required for agent purchases: why this cart was chosen. */
  aiPurchaseReason: z.string().max(2000).optional(),
  /*
   * `discountAmount` used to be accepted here and passed straight through,
   * clamped only to the subtotal. A buying agent holding an API key could
   * therefore name its own discount and order at zero — the merchant still had
   * to approve before money moved, but they were approving a total the buyer
   * had chosen. The discount is now computed server-side from campaigns the
   * merchant actually approved, and this field is gone.
   */
  items: z
    .array(
      z.object({
        isUpsell: z.boolean().optional(),
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(100),
      })
    )
    .min(1),
  merchantId: z.uuid(),
  notes: z.record(z.string(), z.string()).optional(),
});

/**
 * POST /api/payments/orders
 *
 * Prices a cart, persists the order, and — for human buyers — creates the
 * Razorpay order. Agent orders come back with `checkout: null` until a merchant
 * approves them via `/api/payments/orders/{orderId}/approve`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    // A key issued by one shop must not order from another. The merchantId
    // arrives in the body, so without this the caller picks their own scope.
    assertKeyScope(actor, body.merchantId);

    // Priced by the store, exactly as the in-app agent prices it.
    const quote = await quoteForMerchant(body.merchantId, body.items);

    const result = await createCheckoutOrder({
      aiPurchaseReason: body.aiPurchaseReason,
      buyerIdentifier: actor.identifier,
      buyerType: actor.type,
      campaignId: quote.appliedCampaign?.id ?? null,
      discountAmount: quote.discountPaise,
      items: body.items,
      merchantId: body.merchantId,
      notes: body.notes,
      userId: actor.userId,
    });

    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
