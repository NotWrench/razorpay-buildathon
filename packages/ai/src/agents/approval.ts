import { cartCheckoutLines } from "@workspace/commerce/carts";
import type { ToolApprovalStatus } from "ai";
import type { AgentContext } from "../context";
import { formatPaise } from "../money";
import { quoteCart } from "../quote";
import { describeActivation } from "../tools/campaigns";

/**
 * The approval gate.
 *
 * `AGENT_AUTO_APPROVE_CEILING_PAISE` ships at 0, so in practice every money
 * action stops and waits for a human. The ceiling exists so the bound is a
 * stated policy with a visible value rather than an implicit habit — and so a
 * merchant who wants small orders to flow can say so deliberately.
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

  const createPaymentLink: ApprovalFor<{ orderId: string }> = () =>
    requireApproval(
      "Issue a Razorpay payment link for this order? The link lets the payment be completed."
    );

  const cancelOrder: ApprovalFor<{ orderId: string; reason: string }> = () =>
    requireApproval("Cancel this order?");

  return { cancelOrder, createOrder, createPaymentLink };
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
