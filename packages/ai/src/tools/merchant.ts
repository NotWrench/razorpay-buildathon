import { db, orderItems, products } from "@workspace/db";
import {
  approveOrder,
  getOrderOrThrow,
  rejectOrder,
} from "@workspace/payments";
import { type ToolSet, tool } from "ai";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  getAttachRates,
  getPaymentHealth,
  getPendingAgentOrders,
  getProductPerformance,
  getSalesSummary,
  getSlowMovers,
} from "../analytics";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import { formatPaise } from "../money";

/**
 * Merchant-facing tools: read the business, then act on it.
 *
 * The analytics tools are read-only and ungated. `approveAgentOrder` and
 * `rejectAgentOrder` move money and are gated — the merchant approving an
 * order is exactly the human-in-the-loop moment the whole design exists for,
 * so the agent may prepare it but never perform it unattended.
 */
export function merchantTools(ctx: AgentContext) {
  return {
    approveAgentOrder: tool({
      description:
        "Approve a pending agent order. This creates the Razorpay order and " +
        "lets the buyer pay, so it is a real money action — only call it when " +
        "the merchant has clearly said to approve this specific order.",
      execute: async ({ explanation, orderId }) => {
        const order = await getOrderOrThrow(orderId);

        if (order.merchantId !== ctx.merchantId) {
          return {
            approved: false,
            error: "That order belongs to another store.",
          };
        }

        const result = await approveOrder({
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          explanation,
          orderId,
        });

        await recordAudit({
          action: AuditAction.APPROVAL_GRANTED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "merchant",
          explanation,
          merchantId: ctx.merchantId,
          orderId,
        });

        return {
          approved: true,
          orderId,
          razorpayOrderId: result.order.razorpayOrderId,
          total: formatPaise(result.order.totalAmount),
        };
      },
      inputSchema: z.object({
        explanation: z.string().min(5).max(1000),
        orderId: z.uuid(),
      }),
    }),

    findSlowMovers: tool({
      description:
        "Products holding stock that are not selling. These are the campaign " +
        "candidates — always check here before proposing a discount.",
      execute: async ({ limit, windowDays }) => {
        const rows = await getSlowMovers(ctx.merchantId, windowDays, limit);

        return {
          products: rows.map((row) => ({
            ...row,
            price: formatPaise(row.pricePaise),
            tiedUpCapital: formatPaise(row.pricePaise * row.stock),
          })),
          windowDays,
        };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(8),
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    getAgentOrderQueue: tool({
      description:
        "Orders waiting on the merchant's approval, each with the reason the " +
        "buying agent gave. Nothing in this queue has been charged.",
      execute: async () => {
        const pending = await getPendingAgentOrders(ctx.merchantId);

        if (pending.length === 0) {
          return { orders: [] };
        }

        const items = await db
          .select({
            name: products.name,
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(
            inArray(
              orderItems.orderId,
              pending.map((order) => order.id)
            )
          );

        return {
          orders: pending.map((order) => ({
            buyerIdentifier: order.buyerIdentifier,
            buyerType: order.buyerType,
            createdAt: order.createdAt,
            items: items
              .filter((item) => item.orderId === order.id)
              .map((item) => `${item.quantity} x ${item.name}`),
            orderId: order.id,
            reason: order.aiPurchaseReason,
            total: formatPaise(order.totalAmount),
            totalPaise: order.totalAmount,
          })),
        };
      },
      inputSchema: z.object({}),
    }),

    getAttachRate: tool({
      description:
        "Measured co-purchase rates: how often product B appears in orders " +
        "containing product A. This is the evidence for a bundle — cite the " +
        "actual number, never estimate it.",
      execute: async ({ anchorProductId, limit }) => {
        const rates = await getAttachRates(ctx.merchantId, {
          anchorProductId,
          limit,
        });

        return {
          attachRates: rates.map((rate) => ({
            ...rate,
            attachRatePercent: Number((rate.attachRate * 100).toFixed(1)),
          })),
        };
      },
      inputSchema: z.object({
        anchorProductId: z.uuid().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    }),
    getSalesSummary: tool({
      description:
        "Headline numbers for the store: revenue, paid and failed orders, " +
        "average order value, units sold, and how many agent orders are " +
        "waiting on approval.",
      execute: async ({ windowDays }) => {
        const summary = await getSalesSummary(ctx.merchantId, windowDays);
        const health = await getPaymentHealth(ctx.merchantId);

        return {
          ...summary,
          averageOrderValue: formatPaise(summary.averageOrderValuePaise),
          paymentHealth: health,
          revenue: formatPaise(summary.revenuePaise),
        };
      },
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    getTopPerformers: tool({
      description: "Best-selling products by units and revenue.",
      execute: async ({ limit, windowDays }) => {
        const rows = await getProductPerformance(ctx.merchantId, windowDays);

        return {
          products: rows.slice(0, limit).map((row) => ({
            ...row,
            revenue: formatPaise(row.revenuePaise),
          })),
        };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(8),
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    rejectAgentOrder: tool({
      description:
        "Reject and cancel a pending agent order, with the reason recorded.",
      execute: async ({ explanation, orderId }) => {
        const order = await getOrderOrThrow(orderId);

        if (order.merchantId !== ctx.merchantId) {
          return {
            error: "That order belongs to another store.",
            rejected: false,
          };
        }

        await rejectOrder({
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          explanation,
          orderId,
        });

        await recordAudit({
          action: AuditAction.APPROVAL_DENIED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "merchant",
          explanation,
          merchantId: ctx.merchantId,
          orderId,
        });

        return { orderId, rejected: true };
      },
      inputSchema: z.object({
        explanation: z.string().min(5).max(1000),
        orderId: z.uuid(),
      }),
    }),
  } satisfies ToolSet;
}
