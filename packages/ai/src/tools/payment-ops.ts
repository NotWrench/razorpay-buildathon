import { db, orders, payments } from "@workspace/db";
import {
  createPaymentLinkForOrder,
  getPaymentStatus,
  recordFailure,
  refundPayment,
  toPaymentError,
} from "@workspace/payments";
import { type ToolSet, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import { formatPaise } from "../money";

/**
 * Money moving back out, and money being chased.
 *
 * `getPaymentHealth` could always tell the merchant something had gone wrong
 * and the agent could do nothing about it. These two are the actions that
 * follow from what it reports — and they are the merchant's most anxious
 * moment, so the refusal path matters more here than the happy one.
 *
 * Razorpay is the authority on both. When it says no, nothing local moves: the
 * order and the payment keep the state they had, the gateway's own message is
 * written to `failures`, and the merchant is told what actually happened. A
 * success the money never followed is the worst thing this system could show.
 */
export function paymentOpsTools(ctx: AgentContext) {
  return {
    getOrderPaymentStatus: tool({
      description:
        "The live payment state of one order, from our own records. Read " +
        "this before saying anything about whether an order was paid, " +
        "refunded or failed — never from what you remember of the " +
        "conversation.",
      execute: async ({ orderId }) => {
        const order = await db.query.orders.findFirst({
          where: and(
            eq(orders.id, orderId),
            eq(orders.merchantId, ctx.merchantId)
          ),
        });

        if (!order) {
          return { found: false };
        }

        const status = await getPaymentStatus(orderId);

        return {
          approvalStatus: status.approvalStatus,
          found: true,
          orderStatus: status.orderStatus,
          paymentStatus: status.payment?.status ?? "none",
          total: formatPaise(order.totalAmount),
        };
      },
      inputSchema: z.object({ orderId: z.uuid() }),
    }),

    issuePaymentLink: tool({
      description:
        "Send a fresh Razorpay payment link for an approved but unpaid " +
        "order. Use it to recover an order that stalled at checkout — the " +
        "buyer already chose, so this is the cheapest revenue in the store. " +
        "It pauses for the merchant's approval.",
      execute: async ({ orderId }) => {
        const order = await db.query.orders.findFirst({
          where: and(
            eq(orders.id, orderId),
            eq(orders.merchantId, ctx.merchantId)
          ),
        });

        if (!order) {
          return { error: "That order is not in this store.", issued: false };
        }

        if (order.orderStatus === "paid") {
          return {
            error: "That order is already paid. Nothing to chase.",
            issued: false,
          };
        }

        if (order.approvalStatus !== "approved") {
          return {
            error:
              "That order has not been approved yet, so there is nothing to pay for. Approve it first.",
            issued: false,
          };
        }

        try {
          const link = await createPaymentLinkForOrder({ orderId });

          await recordAudit({
            action: "PAYMENT_LINK_CREATED",
            actorId: ctx.actor.userId ?? ctx.actor.identifier,
            actorType: "merchant",
            explanation: `Issued a payment link to recover an unpaid order worth ${formatPaise(order.totalAmount)}.`,
            merchantId: ctx.merchantId,
            orderId,
          });

          return {
            issued: true,
            // `reused` means an unexpired link already existed. Saying so
            // stops the agent claiming it sent a second one.
            reused: link.reused,
            summary: link.reused
              ? `That order already has a live payment link for ${formatPaise(order.totalAmount)}.`
              : `A payment link for ${formatPaise(order.totalAmount)} is ready to send.`,
            url: link.paymentLinkUrl,
          };
        } catch (error) {
          const problem = toPaymentError(error);

          await recordFailure({
            errorMessage: problem.message,
            errorType: "PAYMENT_LINK_FAILED",
            orderId,
          });

          return {
            error: `Razorpay would not create the link: ${problem.message}`,
            issued: false,
          };
        }
      },
      inputSchema: z.object({ orderId: z.uuid() }),
    }),

    refundOrder: tool({
      description:
        "Refund a captured payment in full. This moves real money back to " +
        "the buyer, so it pauses for the merchant's approval. If Razorpay " +
        "refuses, say exactly what it said and that nothing moved — do not " +
        "retry, and do not describe the order as refunded.",
      execute: async ({ orderId, reason }) => {
        const order = await db.query.orders.findFirst({
          where: and(
            eq(orders.id, orderId),
            eq(orders.merchantId, ctx.merchantId)
          ),
        });

        if (!order) {
          return { error: "That order is not in this store.", refunded: false };
        }

        const payment = await db.query.payments.findFirst({
          where: and(
            eq(payments.orderId, orderId),
            eq(payments.status, "captured")
          ),
        });

        if (!payment?.razorpayPaymentId) {
          return {
            error:
              "There is no captured payment on this order, so there is nothing to refund. Nothing was charged in the first place.",
            refunded: false,
          };
        }

        try {
          await refundPayment({
            razorpayPaymentId: payment.razorpayPaymentId,
          });
        } catch (error) {
          const problem = toPaymentError(error);

          /*
           * The graceful failure this system is meant to demonstrate. The
           * order and the payment are deliberately left exactly as they were:
           * the refund did not happen, so nothing pretends it did, and the
           * gateway's own words go into the trail where `explainDecision` can
           * read them back later.
           */
          await recordFailure({
            errorMessage: problem.message,
            errorType: "REFUND_REJECTED",
            orderId,
          });

          await recordAudit({
            action: AuditAction.REFUND_FAILED,
            actorId: ctx.actor.userId ?? ctx.actor.identifier,
            actorType: "merchant",
            explanation: `Razorpay refused the refund: ${problem.message}. No money moved and the order is unchanged.`,
            merchantId: ctx.merchantId,
            metadata: { code: problem.code, reason },
            orderId,
          });

          return {
            error: `Razorpay refused the refund: ${problem.message}`,
            refunded: false,
            state:
              "Nothing moved. The order and the payment are exactly as they were.",
          };
        }

        await recordAudit({
          action: AuditAction.REFUND_ISSUED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "merchant",
          explanation: reason,
          merchantId: ctx.merchantId,
          metadata: { amountPaise: payment.amount },
          orderId,
        });

        return {
          refunded: true,
          summary: `Refunded ${formatPaise(payment.amount)} to the buyer. Razorpay confirmed it.`,
        };
      },
      inputSchema: z.object({
        orderId: z.uuid(),
        reason: z
          .string()
          .min(10)
          .max(1000)
          .describe("Why the money is going back. Recorded against the order."),
      }),
    }),
  } satisfies ToolSet;
}
