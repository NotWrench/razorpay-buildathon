import { campaigns, db, products } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getProductPerformance } from "../analytics";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import { clampDiscountPercent, clampFlatDiscount, LIMITS } from "../guardrails";
import { formatPaise, percentageOff } from "../money";

/**
 * Campaign drafting and activation.
 *
 * Drafting is free — a draft never changes a price. Activation is gated,
 * because an active campaign discounts real money on every subsequent order.
 * Discounts are clamped server-side, so a model that proposes 80% off produces
 * a 30% campaign and says so.
 */

const PROJECTION_UPLIFT = {
  /** Conservative demand response used for the projection, stated openly. */
  bundle: 0.35,
  flat: 0.2,
  percentage: 0.25,
} as const;

interface ImpactProjection {
  assumptions: string[];
  projectedIncrementalRevenue: string;
  projectedIncrementalRevenuePaise: number;
  projectedUnitUplift: number;
}

export function campaignTools(ctx: AgentContext) {
  return {
    activateCampaign: tool({
      description:
        "Activate an approved campaign so it starts discounting live orders. " +
        "This is a money action — only call it when the merchant has said to " +
        "activate this specific campaign.",
      execute: async ({ campaignId }) => {
        const campaign = await db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, campaignId),
            eq(campaigns.merchantId, ctx.merchantId)
          ),
        });

        if (!campaign) {
          return { activated: false, error: "No such campaign in this store." };
        }

        await db
          .update(campaigns)
          .set({ approvedByMerchant: true, status: "active" })
          .where(eq(campaigns.id, campaignId));

        await recordAudit({
          action: AuditAction.CAMPAIGN_APPROVED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "merchant",
          explanation: `Merchant activated the campaign "${campaign.title}"`,
          merchantId: ctx.merchantId,
          metadata: { campaignId },
        });

        return {
          activated: true,
          campaignId,
          summary: `"${campaign.title}" is live and will apply to matching carts from now on.`,
        };
      },
      inputSchema: z.object({ campaignId: z.uuid() }),
    }),
    draftCampaign: tool({
      description:
        "Draft a discount or bundle for the merchant to review. Base it on " +
        "evidence you have actually pulled — getDiscountCandidates, " +
        "findSlowMovers, getAttachRate — and name which tool it came from in " +
        "basedOn, so the merchant can re-run it. Drafting changes no prices; " +
        "the merchant must approve it before it affects a single order.",
      execute: async (input) => {
        const rows = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.merchantId, ctx.merchantId),
              inArray(products.id, input.productIds)
            )
          );

        if (rows.length === 0) {
          return {
            drafted: false,
            error: "None of those products are in this store.",
          };
        }

        const clampedValue =
          input.discountType === "percentage"
            ? clampDiscountPercent(input.discountValue)
            : input.discountValue;

        const wasClamped = clampedValue !== input.discountValue;

        const projection = projectImpact(
          input.discountType,
          clampedValue,
          await getProductPerformance(ctx.merchantId),
          rows.map((row) => row.id)
        );

        const [campaign] = await db
          .insert(campaigns)
          .values({
            aiGeneratedReason: input.reason,
            description: input.description ?? null,
            discountType: input.discountType,
            discountValue: clampedValue,
            merchantId: ctx.merchantId,
            status: "pending_approval",
            title: input.title,
            triggerRules: {
              // Provenance travels with the campaign, so a merchant reviewing
              // it a week later can re-run the query that produced it rather
              // than take the reason on trust.
              basedOn: input.basedOn ?? null,
              productIds: input.productIds,
              requiresAllProducts: input.requiresAllProducts,
            },
          })
          .returning();

        if (!campaign) {
          return { drafted: false, error: "Could not save the draft." };
        }

        await recordAudit({
          action: AuditAction.CAMPAIGN_DRAFTED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "ai_assistant",
          explanation: input.reason,
          merchantId: ctx.merchantId,
          metadata: {
            basedOn: input.basedOn ?? null,
            campaignId: campaign.id,
            discountType: input.discountType,
            discountValue: clampedValue,
          },
        });

        return {
          campaignId: campaign.id,
          discountValue: clampedValue,
          drafted: true,
          note: wasClamped
            ? `The discount was capped at ${LIMITS.maxDiscountPercent}% by policy (you proposed ${input.discountValue}%). Tell the merchant this.`
            : input.basedOn
              ? undefined
              : "No evidence source was recorded. Pull the numbers and say which tool they came from — a discount with no cited basis is one the merchant cannot check.",
          projection,
          status: "pending_approval",
          summary: `"${input.title}" is drafted and waiting for approval. It changes no prices until approved.`,
        };
      },
      inputSchema: z.object({
        basedOn: z
          .object({
            /** The measured figures, so the claim is checkable. */
            evidence: z.string().min(10).max(600),
            tool: z.enum([
              "getDiscountCandidates",
              "findSlowMovers",
              "getAttachRate",
              "getTopPerformers",
              "getStockRisk",
            ]),
            windowDays: z.number().int().min(1).max(365),
          })
          .optional()
          .describe(
            "Which tool produced the evidence, over what window, and the numbers it returned."
          ),
        description: z.string().max(1000).optional(),
        discountType: z.enum(["percentage", "flat", "bundle"]),
        discountValue: z
          .number()
          .int()
          .positive()
          .describe(
            "For percentage: whole percent (capped at 30). For flat/bundle: paise off."
          ),
        productIds: z
          .array(z.uuid())
          .min(1)
          .max(10)
          .describe("Products the campaign applies to."),
        reason: z
          .string()
          .min(30)
          .max(2000)
          .describe(
            "The business case, citing the numbers you looked up. The merchant reads this."
          ),
        requiresAllProducts: z
          .boolean()
          .default(false)
          .describe(
            "True for a true bundle: every product must be in the cart."
          ),
        title: z.string().min(3).max(120),
      }),
    }),

    listCampaigns: tool({
      description: "Campaigns for this store and their status.",
      execute: async () => {
        const rows = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.merchantId, ctx.merchantId));

        return {
          campaigns: rows.map((row) => ({
            approvedByMerchant: row.approvedByMerchant,
            campaignId: row.id,
            discountType: row.discountType,
            discountValue: row.discountValue,
            reason: row.aiGeneratedReason,
            status: row.status,
            title: row.title,
          })),
        };
      },
      inputSchema: z.object({}),
    }),
  } satisfies ToolSet;
}

/**
 * A deliberately simple projection with its assumptions on the label.
 *
 * An unexplained forecast is worse than no forecast, so the uplift factor and
 * the baseline are both returned for the merchant to judge.
 */
function projectImpact(
  discountType: "percentage" | "flat" | "bundle",
  discountValue: number,
  performance: Awaited<ReturnType<typeof getProductPerformance>>,
  productIds: string[]
): ImpactProjection {
  const affected = performance.filter((row) =>
    productIds.includes(row.productId)
  );

  const baselineUnits = affected.reduce((sum, row) => sum + row.unitsSold, 0);
  const averagePrice =
    affected.length === 0
      ? 0
      : Math.round(
          affected.reduce((sum, row) => sum + row.pricePaise, 0) /
            affected.length
        );

  const uplift = PROJECTION_UPLIFT[discountType];
  const projectedUnitUplift = Math.max(1, Math.round(baselineUnits * uplift));

  const discountPerUnit =
    discountType === "percentage"
      ? percentageOff(averagePrice, discountValue)
      : clampFlatDiscount(discountValue, averagePrice);

  const incremental = projectedUnitUplift * (averagePrice - discountPerUnit);

  return {
    assumptions: [
      `Baseline of ${baselineUnits} unit(s) sold across the selected products in the last 30 days`,
      `Assumed ${Math.round(uplift * 100)}% demand uplift for a ${discountType} offer`,
      `Average selling price of ${formatPaise(averagePrice)} before discount`,
      "Ignores cannibalisation of full-price sales — treat as an upper bound",
    ],
    projectedIncrementalRevenue: formatPaise(incremental),
    projectedIncrementalRevenuePaise: incremental,
    projectedUnitUplift,
  };
}
