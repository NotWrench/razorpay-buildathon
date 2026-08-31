import { auditLogs, db, failures, orders } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AgentContext } from "../context";
import { formatPaise } from "../money";
import { getReasoningChain } from "../persistence";

/**
 * Reading back the trail.
 *
 * The agent can be asked "why did this happen?" and answer from the record
 * rather than from its own memory of the conversation — which is the only
 * version of that answer worth trusting.
 */
export function explainTools(ctx: AgentContext) {
  return {
    explainDecision: tool({
      description:
        "Read the recorded audit trail and reasoning chain for an order and " +
        "explain what happened and why. Use the record, not your recollection.",
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

        const [trail, failureRows, reasoning] = await Promise.all([
          db
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.orderId, orderId))
            .orderBy(auditLogs.createdAt),
          db.select().from(failures).where(eq(failures.orderId, orderId)),
          getReasoningChain(ctx.conversationId),
        ]);

        return {
          auditTrail: trail.map((entry) => ({
            action: entry.action,
            actor: entry.actorType,
            at: entry.createdAt,
            explanation: entry.explanation,
          })),
          failures: failureRows.map((row) => ({
            message: row.errorMessage,
            recoveryAction: row.recoveryAction,
            resolved: row.resolved,
            type: row.errorType,
          })),
          found: true,
          order: {
            approvalStatus: order.approvalStatus,
            orderStatus: order.orderStatus,
            purchaseReason: order.aiPurchaseReason,
            total: formatPaise(order.totalAmount),
          },
          reasoning: reasoning.map((step) => ({
            action: step.actionTaken,
            confidence: step.confidence,
            step: step.stepNumber,
            thought: step.thoughtSummary,
          })),
        };
      },
      inputSchema: z.object({ orderId: z.uuid() }),
    }),

    getAuditTrail: tool({
      description:
        "Recent audited actions for this store — who did what, and why. Use " +
        "when asked what the AI has been doing or what changed.",
      execute: async ({ limit }) => {
        const rows = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.merchantId, ctx.merchantId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit);

        return {
          entries: rows.map((row) => ({
            action: row.action,
            actor: row.actorType,
            at: row.createdAt,
            explanation: row.explanation,
            orderId: row.orderId,
          })),
        };
      },
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
    }),
  } satisfies ToolSet;
}
