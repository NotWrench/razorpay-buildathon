import { cartCheckoutLines } from "@workspace/commerce/carts";
import type { ToolApprovalStatus } from "ai";
import type { AgentContext } from "../context";
import { formatPaise } from "../money";
import { quoteCart } from "../quote";

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

/** Approval policy for the merchant agent: approvals and campaign activation. */
export function merchantApproval(_ctx: AgentContext) {
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

  const activateCampaign: ApprovalFor<{ campaignId: string }> = () =>
    requireApproval(
      "Activate this campaign? It will discount every matching order from now on."
    );

  return { activateCampaign, approveAgentOrder, rejectAgentOrder };
}
