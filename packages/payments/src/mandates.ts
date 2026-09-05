import { buyerMandates, type BuyerMandate, db, type Order } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { recordAudit } from "./audit";
import { getMerchantGateway, type MerchantGateway } from "./client";
import { PaymentError, toPaymentError } from "./errors";
import { assertMandateCovers, type MandateCheck } from "./mandate-policy";
import {
  markPaymentCaptured,
  resolvePaymentContext,
  type PaymentContext,
} from "./settlement";

/**
 * Charging a standing authorisation, without a browser.
 *
 * This is the last mile the AI-buyer path was missing. Everything up to here —
 * discovery, the catalogue, the quote, the order, the merchant's approval —
 * already happened without a person; the payment did not, because completing
 * one meant a human clicking a Razorpay window.
 *
 * Two implementations sit behind one interface, and which one runs is a
 * property of the mandate rather than of this deployment, so a store with a
 * recurring entitlement and one without can coexist in the same database.
 *
 * The seam exists for an honest reason. `payments.createRecurringPayment`
 * needs Recurring Payments enabled on the Razorpay account, and UPI Autopay
 * and emandate need activation beyond plain test keys. If that entitlement is
 * off, the real path is dark — and the schema, the guardrail, the audit trail,
 * the agent tool and the buyer script must not be waiting on a dashboard
 * setting to be written. Only the class behind this interface differs.
 *
 * The simulated implementation is *labelled*, everywhere it touches: on the
 * mandate row, in the audit entry, and in the value it returns. A simulation
 * that says what it is is honest; one that does not is a lie about money, and
 * this project's entire argument is that the record can be trusted.
 */

export interface ChargeInput {
  gateway: MerchantGateway;
  mandate: BuyerMandate;
  order: Order;
  payment: PaymentContext;
}

export interface ChargeResult {
  /** True when no gateway call was made. Travels into the audit entry. */
  simulated: boolean;
  razorpayPaymentId: string;
}

export interface PaymentInstrument {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

/**
 * A real token charged through Razorpay's recurring API.
 *
 * The order already exists at the gateway — `activateOrder` created it when
 * the merchant approved — so this attaches a payment to it using the token the
 * buyer authorised, rather than opening a checkout for one.
 */
const recurringInstrument: PaymentInstrument = {
  async charge({ gateway, mandate, order }) {
    if (!(mandate.razorpayTokenId && mandate.razorpayCustomerId)) {
      throw new PaymentError(
        "MANDATE_REFUSED",
        "This authorisation has no payment token attached, so it cannot be charged."
      );
    }

    /*
     * Razorpay wants both on every recurring charge, and there is no browser
     * and no session left to ask by the time we are here. They are captured
     * when the mandate is authorised precisely so this cannot fail at the
     * moment money is supposed to move.
     */
    if (!(mandate.buyerEmail && mandate.buyerContact)) {
      throw new PaymentError(
        "MANDATE_REFUSED",
        "This authorisation is missing the contact details Razorpay requires for a recurring charge."
      );
    }

    if (!order.razorpayOrderId) {
      throw new PaymentError(
        "ORDER_NOT_APPROVED",
        "The order has no Razorpay order yet, so there is nothing to charge against."
      );
    }

    try {
      const created = await gateway.client.payments.createRecurringPayment({
        amount: order.totalAmount,
        contact: mandate.buyerContact,
        currency: order.currency,
        customer_id: mandate.razorpayCustomerId,
        description: `Agent purchase for order ${order.id}`,
        email: mandate.buyerEmail,
        notes: { mandateId: mandate.id, orderId: order.id },
        order_id: order.razorpayOrderId,
        recurring: true,
        token: mandate.razorpayTokenId,
      });

      const paymentId = (created as { razorpay_payment_id?: string })
        .razorpay_payment_id;

      if (!paymentId) {
        throw new PaymentError(
          "RAZORPAY_API_ERROR",
          "Razorpay accepted the recurring charge but returned no payment id."
        );
      }

      return { razorpayPaymentId: paymentId, simulated: false };
    } catch (error) {
      throw toPaymentError(error);
    }
  },
};

/**
 * Settlement without a gateway call, for a deployment with no entitlement.
 *
 * The identifier is deliberately not `pay_`-shaped. Anything that looks like a
 * Razorpay payment id will eventually be treated as one — pasted into a
 * dashboard search, reconciled against a settlement report — and come back
 * "not found" with no explanation. `sim_` is unmistakable at a glance and in a
 * grep, which is the point.
 */
const simulatedInstrument: PaymentInstrument = {
  charge({ order }) {
    return Promise.resolve({
      razorpayPaymentId: `sim_${order.id.replaceAll("-", "").slice(0, 20)}`,
      simulated: true,
    });
  },
};

export function instrumentFor(mandate: BuyerMandate): PaymentInstrument {
  return mandate.instrument === "recurring"
    ? recurringInstrument
    : simulatedInstrument;
}

export interface MandateChargeResult {
  check: MandateCheck;
  context: PaymentContext;
  simulated: boolean;
}

/**
 * Pays an order from a buyer's standing authorisation.
 *
 * The order of operations is the whole safety argument, so it is worth stating
 * plainly: the bound is checked first and throws before anything is charged;
 * the gateway is called second; the mandate's running total is advanced only
 * *after* settlement confirms the money moved. A mandate that is debited for a
 * charge that failed would refuse the buyer's next purchase for a reason that
 * never happened, which is a worse failure than the one it was guarding
 * against.
 *
 * The headroom is advanced with a relative update rather than a read and a
 * write, so two charges settling at the same instant both count — the same
 * reason `chargeCampaignBudget` is written that way.
 */
export async function chargeMandate(params: {
  mandate: BuyerMandate;
  order: Order;
}): Promise<MandateChargeResult> {
  const { mandate, order } = params;

  if (order.approvalStatus !== "approved") {
    throw new PaymentError(
      "ORDER_NOT_APPROVED",
      "This order is still waiting for the merchant, so it cannot be paid yet."
    );
  }

  if (order.orderStatus === "paid") {
    throw new PaymentError("ORDER_ALREADY_PAID", "Order is already paid");
  }

  // Refuses before the gateway is touched. Logs the reason to `failures` and
  // `audit_logs` on the way out — see `assertMandateCovers`.
  const check = await assertMandateCovers(mandate, {
    merchantId: order.merchantId,
    orderId: order.id,
    totalPaise: order.totalAmount,
  });

  const gateway = await getMerchantGateway(order.merchantId);
  const context = await resolvePaymentContext({ orderId: order.id });

  const charged = await instrumentFor(mandate).charge({
    gateway,
    mandate,
    order,
    payment: context,
  });

  const settled = await markPaymentCaptured(context, {
    amount: order.totalAmount,
    razorpayPaymentId: charged.razorpayPaymentId,
  });

  await db
    .update(buyerMandates)
    .set({
      spentPaise: sql`${buyerMandates.spentPaise} + ${order.totalAmount}`,
    })
    .where(eq(buyerMandates.id, mandate.id));

  /*
   * The entry a merchant reads on /manager/activity when nobody approved
   * anything. It has to answer "who authorised this", and the answer is a
   * mandate with numbers on it rather than a person — including what is left,
   * because the next question is always whether it can happen again.
   */
  await recordAudit({
    action: "MANDATE_CHARGED",
    actorId: order.buyerIdentifier,
    actorType: "external_ai_agent",
    explanation: charged.simulated
      ? `${check.message} Settled without calling Razorpay: this store has no recurring entitlement, and the payment is recorded as simulated.`
      : check.message,
    merchantId: order.merchantId,
    metadata: {
      amountPaise: order.totalAmount,
      instrument: charged.simulated ? "mandate_simulated" : "mandate_recurring",
      mandateId: mandate.id,
      razorpayPaymentId: charged.razorpayPaymentId,
      remainingPaise: check.remainingPaise,
    },
    orderId: order.id,
  });

  return { check, context: settled, simulated: charged.simulated };
}

/**
 * Withdraws a mandate.
 *
 * A timestamp rather than a delete, so the charges it already authorised stay
 * explicable. Idempotent: revoking twice keeps the first time, because when
 * the buyer took it back is the fact that matters.
 */
export async function revokeMandate(params: {
  actorId: string;
  mandateId: string;
}): Promise<BuyerMandate> {
  const mandate = await db.query.buyerMandates.findFirst({
    where: eq(buyerMandates.id, params.mandateId),
  });

  if (!mandate) {
    throw new PaymentError(
      "MANDATE_REFUSED",
      "No such authorisation on this account."
    );
  }

  if (mandate.revokedAt) {
    return mandate;
  }

  const [revoked] = await db
    .update(buyerMandates)
    .set({ revokedAt: new Date() })
    .where(eq(buyerMandates.id, mandate.id))
    .returning();

  await recordAudit({
    action: "MANDATE_REVOKED",
    actorId: params.actorId,
    actorType: "human_buyer",
    explanation:
      "The buyer withdrew their standing authorisation. No further order can be paid from it.",
    merchantId: mandate.merchantId,
    metadata: { mandateId: mandate.id, spentPaise: mandate.spentPaise },
  });

  return revoked ?? mandate;
}
