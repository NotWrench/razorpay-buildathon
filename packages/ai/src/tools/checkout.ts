import { cartCheckoutLines } from "@workspace/commerce/carts";
import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { db, orders } from "@workspace/db";
import {
  type CheckoutOrder,
  createCheckoutOrder,
  createCheckoutOrderFromCart,
  createPaymentLinkForOrder,
  getOrderSummary,
  PaymentError,
} from "@workspace/payments";
import { type ToolSet, tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  AuditAction,
  auditActorType,
  RecoveryAction,
  recordAudit,
  recordFailure,
} from "../audit";
import type { AgentContext } from "../context";
import { assertWithinSpendCap } from "../guardrails";
import { formatPaise } from "../money";
import { quoteCart } from "../quote";
import { optional } from "./schema";

/**
 * The money path.
 *
 * Every tool here is gated by `toolApproval` (see `agents/approval.ts`) and
 * bounded by the spend cap. Note what they still cannot do even if the gate
 * were bypassed: `createCheckoutOrder` stamps an agent order
 * `pending_approval` with no Razorpay order behind it, and a payment link
 * refuses to issue for an unapproved order. The gate is convenience; the
 * database is the guarantee.
 */
/**
 * Loads an order the buyer in this context actually placed.
 *
 * Both clauses matter and neither is optional. The merchant check keeps one
 * store out of another's orders; the buyer check keeps one shopper out of
 * another's. `getOrderStatus` was missing the second, so any signed-in buyer
 * could read any order in the store by id — its status, its total and its
 * line items — which is precisely the isolation §20 requires.
 *
 * It lives here as one function because that bug was a third copy of a
 * two-clause check that had drifted to one clause. A single helper is the only
 * version of this that cannot rot.
 *
 * The error says "no order found" rather than "not yours" on purpose: telling
 * a caller an order exists but belongs to someone else is itself a
 * disclosure, and the buyer whose order it is loses nothing by the wording.
 */
async function getOwnedOrder(ctx: AgentContext, orderId: string) {
  const summary = await getOrderSummary(orderId);

  if (
    summary.order.merchantId !== ctx.merchantId ||
    summary.order.buyerIdentifier !== ctx.actor.identifier
  ) {
    throw new PaymentError("ORDER_NOT_FOUND", `No order found for ${orderId}`);
  }

  return summary;
}

export function checkoutTools(ctx: AgentContext) {
  const actorType = auditActorType(ctx.actor.type);

  return {
    cancelOrder: tool({
      description:
        "Cancel an unpaid order at the buyer's request. Releases the order and " +
        "records why. Never call this without the buyer asking.",
      execute: async ({ orderId, reason }) => {
        const summary = await getOwnedOrder(ctx, orderId);

        if (summary.order.orderStatus === "paid") {
          throw new PaymentError(
            "ORDER_ALREADY_PAID",
            "This order is already paid — it needs a refund, not a cancellation."
          );
        }

        await db
          .update(orders)
          .set({ orderStatus: "cancelled" })
          .where(eq(orders.id, orderId));

        await recordAudit({
          action: AuditAction.ORDER_CANCELLED,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: reason,
          merchantId: ctx.merchantId,
          metadata: { totalPaise: summary.order.totalAmount },
          orderId,
        });

        await recordFailure({
          errorMessage: reason,
          errorType: "ORDER_CANCELLED",
          orderId,
          recoveryAction: RecoveryAction.CANCELLED_BY_BUYER,
        });

        return {
          cancelled: true,
          message: `Order cancelled. Nothing was charged${summary.order.totalAmount ? ` — the ${formatPaise(summary.order.totalAmount)} was never taken` : ""}.`,
        };
      },
      inputSchema: z.object({
        orderId: z.uuid(),
        reason: z.string().min(5).max(500),
      }),
    }),
    createOrder: tool({
      description:
        "Create an order the buyer has agreed to. Pass cartId to order the " +
        "buyer's saved cart, or items for a one-off list. This reserves " +
        "nothing and charges nothing — it records the intent and, for a " +
        "signed-in shopper, prepares the Razorpay checkout. Quote first and " +
        "only call this once the buyer has said yes. An order for a cart " +
        "whose build does not pass the compatibility check will be refused.",
      execute: async ({ cartId, items, reason }) => {
        const lines = cartId
          ? await cartCheckoutLines({
              buyerIdentifier: ctx.actor.identifier,
              cartId,
              merchantId: ctx.merchantId,
            })
          : (items ?? []);

        const quote = await quoteCart(ctx, lines);

        await assertWithinSpendCap(ctx, quote.totalPaise);

        await recordAudit({
          action: AuditAction.AGENT_ORDER_REQUESTED,
          actorId: ctx.actor.identifier,
          actorType,
          explanation: reason,
          merchantId: ctx.merchantId,
          metadata: { totalPaise: quote.totalPaise },
        });

        const common = {
          aiPurchaseReason: reason,
          buyerIdentifier: ctx.actor.identifier,
          buyerType: ctx.actor.type,
          discountAmount: quote.discountPaise,
          merchantId: ctx.merchantId,
          notes: { conversationId: ctx.conversationId },
          userId: ctx.actor.userId,
        };

        // The cart path re-runs compatibility inside the payments package and
        // throws before anything is written. That refusal is the backend's,
        // not this tool's — see `packages/payments/src/cart-checkout.ts`.
        let result: CheckoutOrder;
        let warnings: CompatibilityIssue[] = [];

        if (cartId) {
          const fromCart = await createCheckoutOrderFromCart({
            ...common,
            cartId,
          });

          result = fromCart;
          warnings = fromCart.warnings;
        } else {
          result = await createCheckoutOrder({
            ...common,
            items: (items ?? []).map((item) => ({
              isUpsell: item.isUpsell,
              productId: item.productId,
              quantity: item.quantity,
            })),
          });
        }

        const needsMerchantApproval =
          result.order.approvalStatus === "pending_approval";

        return {
          approvalStatus: result.order.approvalStatus,
          breakdown: quote.explanation,
          // Present only for a human buyer; an agent order has none until the
          // merchant approves it.
          checkout: result.checkout,
          /** Non-blocking compatibility findings the buyer must still hear. */
          compatibilityWarnings: warnings.map((issue) => issue.message),
          message: needsMerchantApproval
            ? "The order is recorded and waiting for the merchant to approve it. Nothing has been charged."
            : "The order is ready for payment. Nothing has been charged yet.",
          orderId: result.order.id,
          totalPaise: result.order.totalAmount,
        };
      },
      inputSchema: z
        .object({
          cartId: optional(z.uuid()).describe(
            "Order the buyer's saved cart. Omit to pass items."
          ),
          items: optional(
            z
              .array(
                z.object({
                  isUpsell: z.boolean().default(false),
                  productId: z.uuid(),
                  quantity: z.number().int().min(1).max(10),
                })
              )
              .min(1)
              .max(20)
          ),
          reason: z
            .string()
            .min(20)
            .max(2000)
            .describe(
              "Why this exact cart: what the buyer asked for and why each item " +
                "is in it. This is stored on the order and shown to the merchant."
            ),
        })
        .refine((input) => Boolean(input.cartId) !== Boolean(input.items), {
          message: "Pass either cartId or items, not both and not neither.",
        }),
    }),

    createPaymentLink: tool({
      description:
        "Issue a hosted Razorpay payment link for an approved order. This is " +
        "the safe handoff: the link goes to the human, and no card details " +
        "ever pass through you. Only works once the order is approved.",
      execute: async ({ orderId }) => {
        await getOwnedOrder(ctx, orderId);

        const link = await createPaymentLinkForOrder({ orderId });

        await recordFailure({
          errorMessage: "Buyer asked for a payment link",
          errorType: "PAYMENT_LINK_REQUESTED",
          orderId,
          recoveryAction: RecoveryAction.RETRY_LINK_GENERATED,
        });

        return {
          message:
            "Open this link to pay. It is hosted by Razorpay — I never see your card details.",
          paymentLinkUrl: link.paymentLinkUrl,
          reused: link.reused,
        };
      },
      inputSchema: z.object({
        orderId: z.uuid(),
      }),
    }),

    getOrderStatus: tool({
      description:
        "Current state of an order: approval status, payment attempts and any " +
        "failure with its reason. Call this when the buyer asks what happened, " +
        "or after a payment attempt.",
      execute: async ({ orderId }) => {
        const summary = await getOwnedOrder(ctx, orderId);

        const latest = summary.payments.at(-1);

        return {
          approvalStatus: summary.order.approvalStatus,
          failureReason: latest?.failureReason ?? null,
          items: summary.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            subtotalPaise: item.subtotal,
          })),
          orderStatus: summary.order.orderStatus,
          paymentStatus: latest?.status ?? null,
          recoveryOptions:
            latest?.status === "failed"
              ? [
                  "retry the card payment",
                  "send a hosted payment link to open on another device",
                  "find a cheaper alternative and re-quote",
                  "cancel the order",
                ]
              : [],
          totalPaise: summary.order.totalAmount,
        };
      },
      inputSchema: z.object({ orderId: z.uuid() }),
    }),
  } satisfies ToolSet;
}
