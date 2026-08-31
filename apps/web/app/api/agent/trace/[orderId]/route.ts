import { agentDb, auditLogs, failures } from "@workspace/db";
import { getOrderSummary, PaymentError } from "@workspace/payments";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/api/actor";
import { isMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * GET /api/agent/trace/{orderId}
 *
 * The full explainability record for one order: what was ordered, every
 * audited action in sequence, and every failure with the recovery that was
 * taken. Visible to the buyer who placed it and the merchant who owns it.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/agent/trace/[orderId]">
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { orderId } = await ctx.params;
    const summary = await getOrderSummary(orderId);

    const isBuyer = summary.order.buyerIdentifier === actor.identifier;
    const isMerchant = await isMerchantOwner(actor, summary.order.merchantId);

    if (!(isBuyer || isMerchant)) {
      throw new PaymentError(
        "ORDER_NOT_FOUND",
        `No order found for ${orderId}`
      );
    }

    // getOrderSummary already established the order exists and the caller may
    // see it; the trail for it lives in the agent database.
    const [trail, failureRows] = await Promise.all([
      agentDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.orderId, orderId))
        .orderBy(asc(auditLogs.createdAt)),
      agentDb.select().from(failures).where(eq(failures.orderId, orderId)),
    ]);

    return ok({
      auditTrail: trail,
      failures: failureRows,
      items: summary.items,
      order: summary.order,
      payments: summary.payments,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
