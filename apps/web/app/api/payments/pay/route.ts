import {
  chargeMandate,
  findMandate,
  getOrderOrThrow,
  PaymentError,
} from "@workspace/payments";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { fail, handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({ orderId: z.uuid() });

/**
 * POST /api/payments/pay
 *
 * The last mile, over HTTP.
 *
 * Every other step of the AI-buyer path already existed as a call a third
 * party could make: discover the store, read the catalogue, place the order,
 * poll for the merchant's approval. Paying did not — it ended at a URL for a
 * human to open, which is where "transactable by an AI buyer end to end"
 * stopped being true.
 *
 * Nothing here is trusted from the caller but the order id. The buyer is
 * resolved from the API key or the session, the mandate is looked up for that
 * buyer and that store, the amount comes off the order row, and
 * `chargeMandate` refuses before it charges. A caller can name an order; it
 * cannot name a price, a buyer, a store or an authorisation.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { orderId } = bodySchema.parse(await request.json());
    const order = await getOrderOrThrow(orderId);

    /*
     * Says "no order found" rather than "not yours", for the same reason
     * `getOwnedOrder` does: confirming that an order exists but belongs to
     * someone else is itself a disclosure, and the buyer whose order it is
     * loses nothing by the wording.
     */
    if (order.buyerIdentifier !== actor.identifier) {
      throw new PaymentError(
        "ORDER_NOT_FOUND",
        `No order found for ${orderId}`
      );
    }

    const mandate = await findMandate({
      buyerIdentifier: actor.identifier,
      merchantId: order.merchantId,
    });

    /*
     * Absence is not an error to log — it is the ordinary case, and the honest
     * answer is that this buyer never authorised unattended payment here. 409
     * rather than 403: the request is well-formed and permitted, the account
     * is simply not in a state that can satisfy it, and the caller's next move
     * is a payment link rather than a different credential.
     */
    if (!mandate) {
      return fail(
        "MANDATE_REQUIRED",
        "This buyer has no standing authorisation for this store. Use a payment link instead.",
        409
      );
    }

    const result = await chargeMandate({ mandate, order });

    return ok({
      instrument: result.simulated ? "mandate_simulated" : "mandate_recurring",
      message: result.check.message,
      orderId: order.id,
      orderStatus: result.context.order.orderStatus,
      paid: result.context.payment.status === "captured",
      paymentStatus: result.context.payment.status,
      remainingPaise: result.check.remainingPaise,
      /*
       * Published rather than inferred. A counterparty that cannot tell a
       * gateway settlement from a simulated one has no way to reconcile, and
       * discovering it later is worse than being told now.
       */
      simulated: result.simulated,
      totalPaise: order.totalAmount,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
