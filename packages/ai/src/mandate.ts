import {
  type BuyerMandate,
  checkMandate,
  findMandate,
  getOrderOrThrow,
} from "@workspace/payments";
import type { AgentContext } from "./context";

/**
 * Does this buyer's standing authorisation cover this order?
 *
 * Asked in two places that must never disagree: the approval gate, deciding
 * whether to stop the loop for a human, and the `payForOrder` tool, deciding
 * whether to charge. If the gate let a purchase through that the tool then
 * refused, the buyer would watch their agent claim authority it did not have —
 * so the question is written once and both callers ask it here.
 *
 * Absence of a mandate is not a failure. It is the ordinary case, and it means
 * the purchase goes back to a payment link and a person. Only a mandate that
 * exists and does not stretch far enough is worth logging, and `checkMandate`
 * is used rather than `assertMandateCovers` precisely because asking is not
 * attempting: the gate must be able to look without writing a refusal to the
 * failure log for something nobody tried to do.
 */

export interface MandateCoverage {
  /** True when the agent may pay without stopping for anyone. */
  covered: boolean;
  mandate: BuyerMandate | null;
  /** Why not, when not. Null when there was no mandate to begin with. */
  reason: string | null;
  totalPaise: number;
}

export async function mandateCoverage(
  ctx: AgentContext,
  orderId: string
): Promise<MandateCoverage> {
  const order = await getOrderOrThrow(orderId);

  /*
   * The order is re-read from the database rather than trusted from the model,
   * for the same reason no tool accepts a price: the amount that must fit
   * inside the buyer's cap is the amount the store will actually take.
   */
  const totalPaise = order.totalAmount;

  if (
    order.merchantId !== ctx.merchantId ||
    order.buyerIdentifier !== ctx.actor.identifier
  ) {
    return { covered: false, mandate: null, reason: null, totalPaise };
  }

  const mandate = await findMandate({
    buyerIdentifier: ctx.actor.identifier,
    merchantId: ctx.merchantId,
  });

  if (!mandate) {
    return { covered: false, mandate: null, reason: null, totalPaise };
  }

  const check = checkMandate(mandate, {
    merchantId: ctx.merchantId,
    now: new Date(),
    totalPaise,
  });

  return {
    covered: check.ok,
    mandate,
    reason: check.ok ? null : check.message,
    totalPaise,
  };
}
