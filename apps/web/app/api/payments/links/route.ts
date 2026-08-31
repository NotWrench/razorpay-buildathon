import {
  createPaymentLinkForOrder,
  getOrderOrThrow,
  PaymentError,
} from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { isMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  callbackUrl: z.url().optional(),
  customer: z
    .object({
      contact: z.string().min(8).max(20).optional(),
      email: z.email().optional(),
      name: z.string().max(120).optional(),
    })
    .optional(),
  description: z.string().max(2000).optional(),
  /** Unix seconds. Defaults to 24 hours from now. */
  expireBy: z.number().int().positive().optional(),
  notify: z
    .object({ email: z.boolean().optional(), sms: z.boolean().optional() })
    .optional(),
  orderId: z.uuid(),
});

/**
 * POST /api/payments/links
 *
 * Issues a hosted Razorpay Payment Link for an approved order. This is the
 * handoff an AI agent gets: a URL it can pass to the human, with no card data
 * ever touching the agent.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());
    const order = await getOrderOrThrow(body.orderId);

    const isBuyer = order.buyerIdentifier === actor.identifier;

    if (!(isBuyer || (await isMerchantOwner(actor, order.merchantId)))) {
      throw new PaymentError(
        "ORDER_NOT_FOUND",
        `No order found for ${body.orderId}`
      );
    }

    const link = await createPaymentLinkForOrder({
      callbackUrl: body.callbackUrl,
      customer: body.customer,
      description: body.description,
      expireBy: body.expireBy,
      notify: body.notify,
      orderId: body.orderId,
    });

    return ok(link, link.reused ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
