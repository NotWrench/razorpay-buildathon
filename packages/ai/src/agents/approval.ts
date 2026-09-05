import { cartCheckoutLines } from "@workspace/commerce/carts";
import type { ToolApprovalStatus } from "ai";
import type { AgentContext } from "../context";
import { mandateCoverage } from "../mandate";
import { formatPaise } from "../money";
import { quoteCart } from "../quote";
import { describeActivation } from "../tools/campaigns";

/**
 * The approval gate.
 *
 * Every money action here stops and waits for a human, with one exception, and
 * the exception is the point: a buyer who has given this store a standing
 * authorisation has already answered the payment question in advance, with
 * numbers and an expiry on it. Asking them again is not extra safety — it is
 * ignoring what they said.
 *
 * That is what "gated" means in this system now. Not that a person clicks each
 * time, but that no money moves outside an explicit, bounded, revocable and
 * published authority. The gate did not go away; it moved from the moment of
 * purchase to the moment of delegation, where the person deciding has time to
 * read the numbers. Everything with no delegation behind it still stops here.
 */

type ApprovalFor<INPUT> = (
  input: INPUT
) => Promise<ToolApprovalStatus> | ToolApprovalStatus;

function requireApproval(reason: string): ToolApprovalStatus {
  return { reason, type: "user-approval" };
}

interface CartItem {
  isUpsell?: boolean;
  productId: string;
  quantity: number;
}

/**
 * Approval policy for the storefront agent's money tools.
 *
 * The reason string is what the buyer reads on the confirmation card, so it
 * carries the actual total rather than a generic warning.
 */
export function storefrontApproval(ctx: AgentContext) {
  const createOrder: ApprovalFor<{
    cartId?: string;
    items?: CartItem[];
    reason: string;
  }> = async ({ cartId, items }) => {
    let quote: Awaited<ReturnType<typeof quoteCart>>;

    try {
      // The gate prices whatever is actually about to be ordered, so the
      // total on the confirmation card is the total the buyer will pay —
      // whether it came from a saved cart or an inline list.
      const lines = cartId
        ? await cartCheckoutLines({
            buyerIdentifier: ctx.actor.identifier,
            cartId,
            merchantId: ctx.merchantId,
          })
        : (items ?? []);

      quote = await quoteCart(ctx, lines);
    } catch {
      // If the cart cannot even be priced, let the tool run and produce a
      // proper domain error rather than asking a human to approve nonsense.
      return "not-applicable";
    }

    const { totalPaise } = quote;

    if (totalPaise > ctx.autoApproveCeilingPaise) {
      return requireApproval(
        `Create an order for ${formatPaise(totalPaise)}? Nothing is charged yet — this records the order and opens payment.`
      );
    }
  };

  /**
   * The gate that moves rather than disappears.
   *
   * A buyer with a live authorisation covering this order has already answered
   * this question, in advance, with numbers on it — asking again is not extra
   * safety, it is ignoring what they said. Everyone else still stops here, and
   * so does a buyer whose mandate has lapsed, been withdrawn or run out.
   *
   * `mandateCoverage` only reads; it never writes a refusal. Asking is not
   * attempting, and a gate that logged a failure every time it looked would
   * fill the failure log with purchases nobody made.
   */
  const payForOrder: ApprovalFor<{ orderId: string }> = async ({ orderId }) => {
    try {
      const coverage = await mandateCoverage(ctx, orderId);

      if (coverage.covered) {
        return;
      }

      return requireApproval(
        coverage.reason
          ? `${coverage.reason} Issue a payment link instead?`
          : "Issue a Razorpay payment link for this order? The link lets the payment be completed."
      );
    } catch {
      // An order that cannot even be read is the tool's error to raise, not a
      // question to put to a human.
      return "not-applicable";
    }
  };

  /*
   * Still unconditional, and deliberately so. A mandate is the buyer
   * authorising *this store* to charge *them*; a payment link is a URL anyone
   * holding it can pay. They are not the same permission, and a delegation to
   * do the first is not consent to hand out the second.
   */
  const createPaymentLink: ApprovalFor<{ orderId: string }> = () =>
    requireApproval(
      "Issue a Razorpay payment link for this order? The link lets the payment be completed."
    );

  const cancelOrder: ApprovalFor<{ orderId: string; reason: string }> = () =>
    requireApproval("Cancel this order?");

  return { cancelOrder, createOrder, createPaymentLink, payForOrder };
}

/** Approval policy for the merchant agent: order approvals, campaigns, stock. */
export function merchantApproval(ctx: AgentContext) {
  const approveAgentOrder: ApprovalFor<{
    explanation: string;
    orderId: string;
  }> = () =>
    requireApproval(
      "Approve this agent order? Approving creates the Razorpay order and lets the buyer pay."
    );

  const rejectAgentOrder: ApprovalFor<{
    explanation: string;
    orderId: string;
  }> = () => requireApproval("Reject and cancel this order?");

  /*
   * The card carries the campaign's actual terms and any overlap it would
   * collide with, because the assistant now drafts and asks in one turn — so
   * this is the merchant's whole decision, not a confirmation of one they
   * already made in the thread. See `describeActivation`.
   */
  const activateCampaign: ApprovalFor<{ campaignId: string }> = async ({
    campaignId,
  }) => requireApproval(await describeActivation(ctx.merchantId, campaignId));

  /*
   * Stopping is gated too. It is not a money action in the dangerous
   * direction — nothing is given away — but it changes what every buyer sees
   * at checkout from the next order onward, and an assistant that can quietly
   * end a promotion the merchant is running is as surprising as one that can
   * quietly start it.
   */
  const pauseCampaign: ApprovalFor<{
    campaignId: string;
    reason: string;
  }> = () =>
    requireApproval(
      "Stop this campaign? Matching orders stop being discounted from now on."
    );

  /**
   * §12's inventory mutations.
   *
   * Neither spends money by itself — a reorder request is a request, and a
   * threshold is a setting. They are gated anyway, because both change what
   * the merchant will be told to do next: a threshold quietly raised by the
   * assistant turns into reorder advice the merchant never chose to solicit,
   * and that is the kind of drift §12 exists to prevent.
   */
  const createReorderRequest: ApprovalFor<{
    quantity: number;
    reason: string;
  }> = ({ quantity }) =>
    requireApproval(
      `Raise a reorder request for ${quantity} unit(s)? Nothing is bought — this records the request for you to act on.`
    );

  const updateInventoryThreshold: ApprovalFor<{ productId: string }> = () =>
    requireApproval(
      "Change this product's stock thresholds? It changes which products get flagged for reordering."
    );

  /*
   * Enrichment writes to the catalogue, which is the one artefact external
   * buying agents read. A wrong specification is worse than a missing one: a
   * missing one returns `insufficient_data` and the buyer goes and checks, a
   * wrong one produces a confident answer that sells somebody a part which
   * does not fit. The merchant is the only one who actually knows.
   */
  const enrichProduct: ApprovalFor<{
    productId: string;
    sourcedFrom?: { origin: string; quote: string };
  }> = ({ sourcedFrom }) =>
    requireApproval(
      // The source is on the card, because "approve these specifications" and
      // "approve these specifications, which you told me yourself" are two
      // very different questions to put to a merchant.
      sourcedFrom
        ? `Save these details to the catalogue? Every buying agent reads them from now on. Stated source: ${sourcedFrom.origin.replace(/_/g, " ")} — "${sourcedFrom.quote}"`
        : "Save these details to the catalogue? Every buying agent reads them from now on, so a wrong figure travels."
    );

  /**
   * The riskiest tool here, and the card says why.
   *
   * A price change applies to every future order rather than one, so the
   * merchant is shown the actual figures — the old price, the new one — rather
   * than a generic "change this price?". The bounds around it live in the tool
   * itself; this is the human seeing the number before it moves.
   */
  const updateProductPrice: ApprovalFor<{
    newPricePaise: number;
    reason: string;
  }> = ({ newPricePaise }) =>
    requireApproval(
      `Change this product's price to ${formatPaise(newPricePaise)}? It applies to every order from now on, not just the next one.`
    );

  const refundOrder: ApprovalFor<{ orderId: string; reason: string }> = () =>
    requireApproval(
      "Refund this order in full? The money goes back to the buyer through Razorpay and it cannot be undone."
    );

  const issuePaymentLink: ApprovalFor<{ orderId: string }> = () =>
    requireApproval(
      "Issue a payment link for this order? Anyone holding the link can pay it."
    );

  return {
    activateCampaign,
    approveAgentOrder,
    createReorderRequest,
    enrichProduct,
    issuePaymentLink,
    pauseCampaign,
    refundOrder,
    rejectAgentOrder,
    updateInventoryThreshold,
    updateProductPrice,
  };
}
