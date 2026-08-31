import { AuditAction, recordAudit } from "@workspace/ai";
import { campaigns, db } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({ approved: z.boolean().default(true) }).optional();

/**
 * POST /api/campaigns/{id}/approve
 *
 * The merchant's decision on an AI-drafted campaign. Approving is what makes a
 * discount real — until this call, the draft has never touched a price.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/campaigns/[id]/approve">
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const { id } = await ctx.params;

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
    });

    if (!campaign) {
      throw new PaymentError(
        "MERCHANT_NOT_FOUND",
        `No campaign found for ${id}`
      );
    }

    await assertMerchantOwner(actor, campaign.merchantId);

    const body = bodySchema.parse(await request.json().catch(() => undefined));
    const approved = body?.approved ?? true;

    const [updated] = await db
      .update(campaigns)
      .set({
        approvedByMerchant: approved,
        status: approved ? "active" : "rejected",
      })
      .where(eq(campaigns.id, id))
      .returning();

    await recordAudit({
      action: approved
        ? AuditAction.CAMPAIGN_APPROVED
        : AuditAction.APPROVAL_DENIED,
      actorId: actor.userId ?? actor.identifier,
      actorType: "merchant",
      explanation: approved
        ? `Merchant approved the campaign "${campaign.title}"; it now discounts matching orders`
        : `Merchant rejected the campaign "${campaign.title}"`,
      merchantId: campaign.merchantId,
      metadata: { campaignId: id },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
