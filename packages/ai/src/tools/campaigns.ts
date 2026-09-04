import { campaigns, db, orderItems, orders, products } from "@workspace/db";
import { type ToolSet, tool } from "ai";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { getProductPerformance } from "../analytics";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import {
  checkMarginFloor,
  clampFlatDiscount,
  recordMarginBreach,
} from "../guardrails";
import { getEffectivePolicy } from "../policy";
import { closeTask, openTask } from "../tasks";
import { formatPaise, percentageOff } from "../money";
import { optional } from "./schema";

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
      execute: async ({ acknowledgeOverlap, campaignId }) => {
        const campaign = await db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, campaignId),
            eq(campaigns.merchantId, ctx.merchantId)
          ),
        });

        if (!campaign) {
          return { activated: false, error: "No such campaign in this store." };
        }

        /*
         * Overlap, said out loud.
         *
         * `bestCampaign` picks the single offer worth the most to the buyer,
         * so two live campaigns on the same product do not stack — the smaller
         * one silently stops applying. That is the right pricing behaviour and
         * the wrong thing to leave unsaid: a merchant running two promotions
         * believes both are working, and will read the quieter one's flat
         * numbers as the offer failing rather than as it never being used.
         */
        const overlapping = await findOverlap(ctx.merchantId, campaign);

        if (overlapping.length > 0 && !acknowledgeOverlap) {
          return {
            activated: false,
            error:
              `"${campaign.title}" overlaps ${overlapping.length} live campaign(s) on the same products: ` +
              overlapping
                .map((row) => `"${row.title}" (${describeOffer(row)})`)
                .join(", ") +
              ". Only the offer worth most to the buyer applies, so these will not stack — the weaker one simply stops being used. " +
              "Tell the merchant which one wins, and ask whether to stop the other or activate anyway.",
            overlaps: overlapping.map((row) => ({
              campaignId: row.id,
              offer: describeOffer(row),
              title: row.title,
            })),
          };
        }

        /*
         * The clock starts now, not when it was drafted. A campaign approved
         * three days after the assistant proposed it should still run for the
         * span it was given — otherwise "seven days" quietly becomes four,
         * and the merchant's approval changed the offer.
         */
        const startsAt = new Date();
        const rules = (campaign.triggerRules ?? {}) as {
          runForDays?: number | null;
        };
        const endsAt = rules.runForDays
          ? new Date(startsAt.getTime() + rules.runForDays * DAY_MS)
          : null;

        await db
          .update(campaigns)
          .set({
            approvedByMerchant: true,
            endsAt,
            startsAt,
            status: "active",
          })
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
          endsAt,
          summary:
            `"${campaign.title}" is live and will apply to matching carts from now on. ` +
            (endsAt
              ? `It stops on its own after ${rules.runForDays} day(s).`
              : "It has no end date — it runs until you pause it.") +
            (campaign.budgetPaise
              ? ` It may give away at most ${formatPaise(campaign.budgetPaise)}.`
              : " It has no budget cap."),
        };
      },
      inputSchema: z.object({
        acknowledgeOverlap: z
          .boolean()
          .default(false)
          .describe(
            "Set only after telling the merchant about an overlap and hearing them say to activate anyway."
          ),
        campaignId: z.uuid(),
      }),
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

        // The merchant's own cap where they set one, the platform's otherwise.
        const policy = await getEffectivePolicy(ctx.merchantId);

        const clampedValue =
          input.discountType === "percentage"
            ? Math.max(
                0,
                Math.min(
                  Math.round(input.discountValue),
                  policy.maxDiscountPercent
                )
              )
            : input.discountValue;

        const wasClamped = clampedValue !== input.discountValue;

        /*
         * The second bound, and the one the percentage cap cannot express.
         * 30% off is generous on a case fan and ruinous on a graphics card the
         * shop buys at 90% of list, so the floor is checked per product against
         * its actual cost. A breach refuses the draft rather than trimming it:
         * the merchant asked for a specific discount, and quietly returning a
         * smaller one would be a different campaign wearing the same name.
         */
        const { breaches, unpriced } = await checkMarginFloor(
          ctx.merchantId,
          rows.map((row) => row.id),
          (pricePaise) =>
            input.discountType === "percentage"
              ? percentageOff(pricePaise, clampedValue)
              : clampFlatDiscount(clampedValue, pricePaise)
        );

        if (breaches.length > 0) {
          return {
            breaches: breaches.map((breach) => ({
              cost: formatPaise(breach.costPaise),
              discountedPrice: formatPaise(breach.discountedPricePaise),
              name: breach.name,
            })),
            drafted: false,
            error: await recordMarginBreach(ctx, breaches),
          };
        }

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
            budgetPaise: input.budgetPaise ?? null,
            description: input.description ?? null,
            discountType: input.discountType,
            discountValue: clampedValue,
            // Measured from activation, not from drafting: a draft that sits
            // for three days before anybody approves it should still run for
            // the number of days it was given.
            endsAt: null,
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
              /* Carried on the draft and turned into a real `ends_at` when the
                 merchant activates it. */
              runForDays: input.runForDays ?? null,
            },
          })
          .returning();

        if (!campaign) {
          return { drafted: false, error: "Could not save the draft." };
        }

        /*
         * A campaign is an intent with an outcome, which is exactly what
         * `agent_tasks` is for — and until now no merchant flow opened one, so
         * §24's question ("did the agent actually help") was only answerable
         * on the buyer's side. It closes when the campaign is measured.
         */
        await openTask(ctx, {
          intent: `Campaign: ${input.title}`,
          mode: "campaign",
        });

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
          note:
            [
              wasClamped
                ? `The discount was capped at ${policy.maxDiscountPercent}% — ${policy.merchantConfigured ? "this store's own limit" : "the platform limit"} — against the ${input.discountValue}% you proposed. Tell the merchant this.`
                : null,
              input.basedOn
                ? null
                : "No evidence source was recorded. Pull the numbers and say which tool they came from — a discount with no cited basis is one the merchant cannot check.",
              // An unchecked margin is not a safe margin. Saying which
              // products went unchecked is the difference between "this is
              // above cost" and "we do not know what this costs".
              unpriced.length > 0
                ? `No cost is recorded for ${unpriced.join(", ")}, so the margin on ${unpriced.length === 1 ? "it was" : "those were"} not checked. Say so.`
                : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          projection,
          status: "pending_approval",
          summary: `"${input.title}" is drafted and waiting for approval. It changes no prices until approved.`,
        };
      },
      inputSchema: z.object({
        basedOn: optional(
          z.object({
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
        ).describe(
          "Which tool produced the evidence, over what window, and the numbers it returned."
        ),
        budgetPaise: optional(
          z.number().int().positive().max(100_000_000)
        ).describe(
          "The most this campaign may give away in total, in paise. Propose one — a campaign with no cap runs until somebody notices it."
        ),
        description: optional(z.string().max(1000)),
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
        runForDays: optional(z.number().int().min(1).max(180)).describe(
          "How long it should run once approved. Counted from activation, not from now."
        ),
        title: z.string().min(3).max(120),
      }),
    }),

    getCampaignPerformance: tool({
      description:
        "What a campaign actually did: units and revenue on the orders it " +
        "discounted, against the same products in the equal window before it " +
        "started, with the discount given away and the margin left after it. " +
        "Read the caveat it returns out loud — this is a before-and-after, " +
        "not a controlled experiment.",
      execute: async ({ campaignId }) => {
        const measured = await measureCampaign(ctx.merchantId, campaignId);

        /*
         * The outcome, recorded against the intent. "More units than the
         * window before" is a weak signal and the caveat says so — but it is
         * the only outcome this database can observe, and a task left open
         * forever is indistinguishable from one nobody looked at.
         */
        if (measured.found) {
          await closeTask(
            ctx,
            measured.unitsChange > 0 ? "resolved" : "failed",
            `${measured.title}: ${measured.unitsChange >= 0 ? "+" : ""}${measured.unitsChange} units against the window before, ${measured.givenAway} given away.`
          );
        }

        return measured;
      },
      inputSchema: z.object({ campaignId: z.uuid() }),
    }),

    listCampaigns: tool({
      description:
        "Campaigns for this store: status, discount, and for anything live " +
        "how much of its budget it has spent and how long it has left.",
      execute: async () => {
        const rows = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.merchantId, ctx.merchantId));

        return {
          campaigns: rows.map((row) => ({
            approvedByMerchant: row.approvedByMerchant,
            budget: row.budgetPaise === null ? null : formatPaise(row.budgetPaise),
            campaignId: row.id,
            discountType: row.discountType,
            discountValue: row.discountValue,
            endsAt: row.endsAt,
            reason: row.aiGeneratedReason,
            spent: formatPaise(row.spentPaise),
            startsAt: row.startsAt,
            status: row.status,
            title: row.title,
          })),
        };
      },
      inputSchema: z.object({}),
    }),

    pauseCampaign: tool({
      description:
        "Stop a live campaign discounting any further order. This is a money " +
        "action in the other direction — only call it when the merchant has " +
        "said to stop this specific campaign.",
      execute: async ({ campaignId, reason }) => {
        const campaign = await db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, campaignId),
            eq(campaigns.merchantId, ctx.merchantId)
          ),
        });

        if (!campaign) {
          return { error: "No such campaign in this store.", paused: false };
        }

        if (campaign.status !== "active") {
          return {
            error: `That campaign is ${campaign.status}, not running.`,
            paused: false,
          };
        }

        await db
          .update(campaigns)
          .set({ status: "paused" })
          .where(eq(campaigns.id, campaignId));

        await recordAudit({
          action: AuditAction.CAMPAIGN_PAUSED,
          actorId: ctx.actor.userId ?? ctx.actor.identifier,
          actorType: "merchant",
          explanation: `Paused "${campaign.title}": ${reason}`,
          merchantId: ctx.merchantId,
          metadata: { campaignId, spentPaise: campaign.spentPaise },
        });

        return {
          campaignId,
          paused: true,
          summary: `"${campaign.title}" is stopped. It gave away ${formatPaise(campaign.spentPaise)} before it did. Orders already placed are unaffected.`,
        };
      },
      inputSchema: z.object({
        campaignId: z.uuid(),
        reason: z.string().min(5).max(1000),
      }),
    }),
  } satisfies ToolSet;
}

const DAY_MS = 86_400_000;

/** "20% off" or "₹500 off" — the offer in the merchant's terms. */
function describeOffer(campaign: typeof campaigns.$inferSelect): string {
  return campaign.discountType === "percentage"
    ? `${campaign.discountValue}% off`
    : `${formatPaise(campaign.discountValue)} off`;
}

/**
 * Live campaigns that share a product with this one.
 *
 * Deliberately product-level rather than clever. Two campaigns can collide in
 * subtler ways — a category rule and a product rule reaching the same cart —
 * and a warning that fires on every possible interaction is one nobody reads.
 * Sharing a named product is the case a merchant actually creates by accident.
 */
async function findOverlap(
  merchantId: string,
  candidate: typeof campaigns.$inferSelect
): Promise<(typeof campaigns.$inferSelect)[]> {
  const rules = (candidate.triggerRules ?? {}) as { productIds?: string[] };
  const mine = new Set(rules.productIds ?? []);

  if (mine.size === 0) {
    return [];
  }

  const live = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.merchantId, merchantId),
        eq(campaigns.status, "active"),
        eq(campaigns.approvedByMerchant, true)
      )
    );

  return live.filter((row) => {
    if (row.id === candidate.id) {
      return false;
    }

    const theirs = ((row.triggerRules ?? {}) as { productIds?: string[] })
      .productIds;

    return (theirs ?? []).some((id) => mine.has(id));
  });
}

/**
 * What a campaign actually did, measured against the window before it.
 *
 * A before-and-after is not a control group and this says so in its own
 * output, in the same way `getStockRisk` states its projection assumptions.
 * Without that sentence a merchant reads a good fortnight as a good campaign,
 * and the number becomes worse than useless — it becomes evidence for doing it
 * again.
 *
 * Attribution comes off `orders.campaign_id`, written at checkout from the
 * discount actually applied, so "orders this campaign touched" is a fact
 * rather than an inference from dates. The baseline is the same products over
 * an equal span immediately before it began, which is the closest honest
 * comparison this database can make.
 */
async function measureCampaign(merchantId: string, campaignId: string) {
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.merchantId, merchantId)
    ),
  });

  if (!campaign) {
    return { found: false as const };
  }

  const rules = (campaign.triggerRules ?? {}) as { productIds?: string[] };
  const productIds = rules.productIds ?? [];

  const startedAt = campaign.startsAt ?? campaign.createdAt;
  const ranTo = campaign.endsAt ?? new Date();
  const spanMs = Math.max(DAY_MS, ranTo.getTime() - startedAt.getTime());
  const baselineFrom = new Date(startedAt.getTime() - spanMs);

  // Orders this campaign actually discounted.
  const attributed = await db
    .select({
      discount: orders.discountAmount,
      orderId: orders.id,
      total: orders.totalAmount,
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.campaignId, campaignId),
        eq(orders.orderStatus, "paid")
      )
    );

  const unitsFor = async (from: Date, to: Date) => {
    if (productIds.length === 0) {
      return { revenuePaise: 0, units: 0 };
    }

    const lines = await db
      .select({
        quantity: orderItems.quantity,
        subtotal: orderItems.subtotal,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.merchantId, merchantId),
          eq(orders.orderStatus, "paid"),
          gte(orders.createdAt, from),
          lt(orders.createdAt, to),
          inArray(orderItems.productId, productIds)
        )
      );

    return {
      revenuePaise: lines.reduce((sum, line) => sum + line.subtotal, 0),
      units: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  };

  const [during, baseline] = await Promise.all([
    unitsFor(startedAt, ranTo),
    unitsFor(baselineFrom, startedAt),
  ]);

  const givenAwayPaise = attributed.reduce(
    (sum, row) => sum + row.discount,
    0
  );
  const days = Math.round(spanMs / DAY_MS);

  return {
    attributedOrders: attributed.length,
    baseline: {
      revenue: formatPaise(baseline.revenuePaise),
      units: baseline.units,
    },
    caveat:
      `This compares the ${days} day(s) the campaign ran against the ${days} day(s) before it, on the same products. ` +
      "It is not a controlled experiment: it cannot separate the campaign from seasonality, from a payday, or from anything else that changed in the same fortnight. Read the direction, not the decimal.",
    during: {
      revenue: formatPaise(during.revenuePaise),
      units: during.units,
    },
    found: true as const,
    givenAway: formatPaise(givenAwayPaise),
    status: campaign.status,
    title: campaign.title,
    unitsChange: during.units - baseline.units,
  };
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
