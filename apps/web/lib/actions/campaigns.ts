"use server";

import { AuditAction, recordAudit } from "@workspace/ai";
import { campaigns, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { managerActor } from "@/lib/manager-store";
import { type ActionResult, failed, ok } from "./result";

/**
 * Approving, stopping and rejecting a campaign from the screen.
 *
 * The same three decisions the assistant's approval cards offer, reachable
 * without a conversation — a merchant who already knows what they want should
 * not have to ask an agent for permission to act on their own shop.
 *
 * Activation sets the clock from now rather than from when the campaign was
 * drafted, matching `activateCampaign`: a draft approved three days late
 * should still run for the span it was given, or the merchant's delay silently
 * shortened their own offer.
 */

const DAY_MS = 86_400_000;

async function scoped(campaignId: string) {
  const { actorId, merchantId } = await managerActor();

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.merchantId, merchantId)
    ),
  });

  return { actorId, campaign, merchantId };
}

export async function activateCampaignAction(
  campaignId: string
): Promise<ActionResult> {
  const { actorId, campaign, merchantId } = await scoped(campaignId);

  if (!campaign) {
    return failed("That campaign is not in this store.");
  }

  if (campaign.status === "active") {
    return failed("That campaign is already running.");
  }

  const startsAt = new Date();
  const rules = (campaign.triggerRules ?? {}) as { runForDays?: number | null };
  const endsAt = rules.runForDays
    ? new Date(startsAt.getTime() + rules.runForDays * DAY_MS)
    : null;

  await db
    .update(campaigns)
    .set({ approvedByMerchant: true, endsAt, startsAt, status: "active" })
    .where(eq(campaigns.id, campaignId));

  await recordAudit({
    action: AuditAction.CAMPAIGN_APPROVED,
    actorId,
    actorType: "merchant",
    explanation: `Activated "${campaign.title}" from the campaigns screen.`,
    merchantId,
    metadata: { campaignId, endsAt, budgetPaise: campaign.budgetPaise },
  });

  revalidatePath("/manager/campaigns");

  return ok();
}

export async function pauseCampaignAction(
  campaignId: string
): Promise<ActionResult> {
  const { actorId, campaign, merchantId } = await scoped(campaignId);

  if (!campaign) {
    return failed("That campaign is not in this store.");
  }

  if (campaign.status !== "active") {
    return failed(`That campaign is ${campaign.status}, not running.`);
  }

  await db
    .update(campaigns)
    .set({ status: "paused" })
    .where(eq(campaigns.id, campaignId));

  await recordAudit({
    action: AuditAction.CAMPAIGN_PAUSED,
    actorId,
    actorType: "merchant",
    explanation: `Stopped "${campaign.title}" from the campaigns screen. It had given away ${campaign.spentPaise} paise.`,
    merchantId,
    metadata: { campaignId, spentPaise: campaign.spentPaise },
  });

  revalidatePath("/manager/campaigns");

  return ok();
}

export async function rejectCampaignAction(
  campaignId: string
): Promise<ActionResult> {
  const { actorId, campaign, merchantId } = await scoped(campaignId);

  if (!campaign) {
    return failed("That campaign is not in this store.");
  }

  if (campaign.status === "active") {
    return failed("That campaign is live. Stop it rather than rejecting it.");
  }

  await db
    .update(campaigns)
    .set({ status: "rejected" })
    .where(eq(campaigns.id, campaignId));

  await recordAudit({
    action: AuditAction.CAMPAIGN_REJECTED,
    actorId,
    actorType: "merchant",
    explanation: `Rejected the draft campaign "${campaign.title}". No price ever moved.`,
    merchantId,
    metadata: { campaignId },
  });

  revalidatePath("/manager/campaigns");

  return ok();
}
