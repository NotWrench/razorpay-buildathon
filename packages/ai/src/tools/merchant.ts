import {
  db,
  inventory,
  orderItems,
  products,
  reorderRequests,
} from "@workspace/db";
import {
  approveOrder,
  getOrderOrThrow,
  rejectOrder,
} from "@workspace/payments";
import { type ToolSet, tool } from "ai";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import {
  getCancellationSummary,
  getInventorySummary,
  getLowStockProducts,
  getOrderSummary,
  getStockRisk,
} from "../inventory";
import { formatPaise } from "../money";
import {
  getDiscontinueCandidates,
  getDiscountCandidates,
  getReorderCandidates,
} from "../recommendations";

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

    createReorderRequest: tool({
      description:
        "Raise a reorder request for the merchant to approve. This buys " +
        "nothing and commits nothing — it records the request, the quantity " +
        "and the evidence behind it, and waits for a human. Ground the reason " +
        "in numbers you actually pulled from getReorderCandidates or " +
        "getStockRisk.",
      execute: async ({ productId, quantity, reason }) => {
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, productId),
            eq(products.merchantId, ctx.merchantId)
          ),
        });

        if (!product) {
          return {
            created: false,
            error: "That product is not in this store.",
          };
        }

        const [request] = await db
          .insert(reorderRequests)
          .values({
            createdByAgent: true,
            merchantId: ctx.merchantId,
            productId,
            quantity,
            reason,
            status: "draft",
            stockAtRequest: product.stock,
          })
          .returning();

        if (!request) {
          return { created: false, error: "Could not save the request." };
        }

        await recordAudit({
          action: AuditAction.REORDER_REQUESTED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "ai_assistant",
          explanation: reason,
          merchantId: ctx.merchantId,
          metadata: {
            productId,
            quantity,
            reorderRequestId: request.id,
            stockAtRequest: product.stock,
          },
        });

        return {
          created: true,
          reorderRequestId: request.id,
          status: request.status,
          summary: `Requested ${quantity} more ${product.name} (${product.stock} on hand). Nothing has been ordered — this waits for your approval.`,
        };
      },
      inputSchema: z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(10_000),
        reason: z
          .string()
          .min(30)
          .max(2000)
          .describe(
            "The evidence: velocity, cover and lead time as you measured them. The merchant reads this."
          ),
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

    getCancellationSummary: tool({
      description:
        "Why orders did not complete: cancellations and failures grouped by " +
        "reason, with the value lost. Use this before speculating about why " +
        "conversion is down.",
      execute: async ({ windowDays }) =>
        await getCancellationSummary(ctx.merchantId, windowDays),
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    getDiscontinueCandidates: tool({
      description:
        "Products that have not earned their shelf space over a long window. " +
        "This is a recommendation to review with the merchant, never an " +
        "instruction — there is no tool that removes a product, by design. " +
        "Present the numbers and let them decide.",
      execute: async ({ limit, windowDays }) =>
        await getDiscontinueCandidates(ctx.merchantId, windowDays, limit),
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(10),
        windowDays: z.number().int().min(30).max(365).default(90),
      }),
    }),

    getDiscountCandidates: tool({
      description:
        "Stock that is not moving: weak sales against real quantity on hand, " +
        "with the capital tied up in each. Use this to ground a campaign in " +
        "evidence rather than picking products that feel slow.",
      execute: async ({ limit, windowDays }) =>
        await getDiscountCandidates(ctx.merchantId, windowDays, limit),
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(15),
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    getInventorySummary: tool({
      description:
        "Stock health across the store: how many products, units on hand, " +
        "retail value, how many are out of stock or below their threshold, " +
        "and how many have no threshold configured at all.",
      execute: async () => {
        const summary = await getInventorySummary(ctx.merchantId);

        return {
          ...summary,
          note:
            summary.unconfiguredProducts > 0
              ? `${summary.unconfiguredProducts} product(s) have no low-stock threshold set, so they cannot appear in a low-stock report. Say so rather than implying the store is fully covered.`
              : undefined,
        };
      },
      inputSchema: z.object({}),
    }),

    getLowStockProducts: tool({
      description:
        "Products at or below their configured low-stock threshold, plus " +
        "anything already out of stock. A product with no threshold set is " +
        "not listed here — that is a gap in the data, not a healthy product.",
      execute: async ({ limit }) => {
        const rows = await getLowStockProducts(ctx.merchantId, limit);

        return { count: rows.length, products: rows };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
    }),

    getOrderSummary: tool({
      description:
        "Orders by status over a window — counts and value — plus how many " +
        "are waiting on the merchant's approval.",
      execute: async ({ windowDays }) =>
        await getOrderSummary(ctx.merchantId, windowDays),
      inputSchema: z.object({
        windowDays: z.number().int().min(1).max(365).default(30),
      }),
    }),

    getReorderCandidates: tool({
      description:
        "Products worth reordering, each with measured velocity, days of " +
        "cover and a suggested quantity. The quantity buys back to a month " +
        "of cover, or the merchant's configured reorder quantity if larger. " +
        "Quote the assumptions field — the merchant should be able to " +
        "disagree with the basis, not just the number.",
      execute: async ({ limit, windowDays }) =>
        await getReorderCandidates(ctx.merchantId, windowDays, limit),
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(15),
        windowDays: z.number().int().min(1).max(365).default(30),
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

    getStockRisk: tool({
      description:
        "Products likely to stock out: sales velocity against remaining " +
        "stock, giving days of cover, and whether that is shorter than the " +
        "supplier's lead time. Products that sold nothing are excluded — a " +
        "product nobody is buying will not stock out, it is a different " +
        "problem, and getDiscountCandidates is the tool for it.",
      execute: async ({ limit, windowDays }) => {
        const rows = await getStockRisk(ctx.merchantId, windowDays, limit);

        return {
          assumptions: `Velocity is measured over the last ${windowDays} days of paid orders and projected forward flat — no seasonality, and no allowance for a campaign that has since ended. A product is listed when it has under three weeks of cover, or when its cover is shorter than the supplier's lead time.`,
          count: rows.length,
          products: rows,
          windowDays,
        };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
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

    listReorderRequests: tool({
      description:
        "Reorder requests for this store and their status. Check this before " +
        "raising a new one — a request already waiting does not need a second.",
      execute: async () => {
        const rows = await db
          .select({
            createdAt: reorderRequests.createdAt,
            createdByAgent: reorderRequests.createdByAgent,
            productName: products.name,
            quantity: reorderRequests.quantity,
            reason: reorderRequests.reason,
            reorderRequestId: reorderRequests.id,
            status: reorderRequests.status,
          })
          .from(reorderRequests)
          .innerJoin(products, eq(products.id, reorderRequests.productId))
          .where(eq(reorderRequests.merchantId, ctx.merchantId))
          .orderBy(desc(reorderRequests.createdAt))
          .limit(25);

        return { requests: rows };
      },
      inputSchema: z.object({}),
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

    updateInventoryThreshold: tool({
      description:
        "Set the low-stock threshold, reorder point, reorder quantity or " +
        "supplier lead time for a product. Pass only the fields you are " +
        "changing. Base the numbers on measured velocity and lead time, not " +
        "on a round figure that looks tidy.",
      execute: async ({ productId, ...fields }) => {
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, productId),
            eq(products.merchantId, ctx.merchantId)
          ),
        });

        if (!product) {
          return {
            error: "That product is not in this store.",
            updated: false,
          };
        }

        const patch = Object.fromEntries(
          Object.entries(fields).filter(([, value]) => value !== undefined)
        );

        if (Object.keys(patch).length === 0) {
          return { error: "Nothing to change.", updated: false };
        }

        // Upsert: a product seeded without an inventory row still needs one.
        const [row] = await db
          .insert(inventory)
          .values({
            merchantId: ctx.merchantId,
            productId,
            ...patch,
          })
          .onConflictDoUpdate({
            set: patch,
            target: inventory.productId,
          })
          .returning();

        await recordAudit({
          action: AuditAction.INVENTORY_THRESHOLD_UPDATED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "ai_assistant",
          explanation: `Updated inventory settings for ${product.name}: ${Object.entries(
            patch
          )
            .map(([key, value]) => `${key}=${value}`)
            .join(", ")}`,
          merchantId: ctx.merchantId,
          metadata: { patch, productId },
        });

        return {
          settings: {
            lowStockThreshold: row?.lowStockThreshold ?? null,
            reorderPoint: row?.reorderPoint ?? null,
            reorderQuantity: row?.reorderQuantity ?? null,
            supplierLeadTimeDays: row?.supplierLeadTimeDays ?? null,
          },
          updated: true,
        };
      },
      inputSchema: z.object({
        lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
        productId: z.uuid(),
        reorderPoint: z.number().int().min(0).max(100_000).optional(),
        reorderQuantity: z.number().int().min(1).max(100_000).optional(),
        supplierLeadTimeDays: z.number().int().min(0).max(365).optional(),
      }),
    }),
  } satisfies ToolSet;
}
