import { db, merchants } from "@workspace/db";
import { generateText, isStepCount } from "ai";
import { eq } from "drizzle-orm";
import { AuditAction, recordAudit } from "../audit";
import type { AgentContext } from "../context";
import { chatModel } from "../provider";
import { merchantApproval } from "./approval";
import { merchantToolSet } from "./merchant";
import { repairHarmonyToolName } from "./repair";

/**
 * The merchant agent, run while nobody is watching.
 *
 * This is the only unattended agent in the system, and its safety does not
 * come from this file. It comes from the fact that every tool which moves
 * money returns `user-approval` from `merchantApproval`, and there is no human
 * here to give it — so those tools are *suspended and never execute*. The run
 * can look at everything and change nothing that matters.
 *
 * What it can do is leave drafts. `draftCampaign` and `createReorderRequest`
 * both create rows that are inert by construction: a `pending_approval`
 * campaign changes no price, and a `draft` reorder buys nothing. The merchant
 * wakes up to proposals, not to a shop somebody rearranged.
 *
 * The whole run is audited with `scheduled: true`, because the difference
 * between "the assistant did this while I was asleep" and "the assistant did
 * this because I asked" is the first thing a merchant will want to know.
 */

/**
 * Step budget for one unattended run.
 *
 * It has to cover the whole tool sequence *and* leave steps over for the model
 * to actually write the briefing. At 14 a legitimate run — two sales windows,
 * two margin windows, orders, failures, the queue, stock risk, readiness,
 * discount and reorder candidates — spent its last step on a tool call and
 * returned empty prose, so the run "succeeded" and produced nothing to read.
 * This is a runaway guard, not a behaviour constraint, and it should sit well
 * clear of what a thorough answer costs.
 */
const MAX_STEPS = 22;

const BRIEFING_PROMPT = `You are running unattended, overnight, for a store whose owner is asleep. Nobody will answer a question, and no approval card can be pressed — every tool that moves money is suspended and will simply not run, so do not try to use one.

Your job is to leave the merchant a short briefing they can act on in two minutes:

1. Pull the numbers. getSalesSummary and getMarginSummary over the last 7 days, against the 30 before. getOrderSummary and getFailedPayments for what did not complete.
2. Find the two things that actually changed. Not the two biggest numbers — the two that moved. If nothing moved, say so; a quiet week reported as a quiet week is a useful briefing and an invented insight is not.
3. Check what needs a person: getAgentOrderQueue, getStockRisk, getCatalogReadiness.
4. Draft at most one campaign, and only if getDiscountCandidates gives you real evidence for it. Give it a budget and a run length. If nothing warrants a discount, draft nothing — that is the correct outcome, not a failure.
5. Raise at most one reorder request, and only from getReorderCandidates.

Then stop pulling numbers and write. The briefing is the deliverable — a run that reads everything and says nothing has failed, however thorough the reading was. Do not call a tool you have already called with the same window.

Write the briefing as plain prose in your reply. Lead with what changed and what needs them. Say clearly that nothing you drafted is live and that everything waits for them.

Be short. This is read over a first coffee, not studied.`;

export interface BriefingResult {
  /** Tools whose calls were suspended for an approval nobody could give. */
  blockedTools: string[];
  draftedCampaigns: number;
  raisedReorders: number;
  text: string;
  toolsUsed: string[];
}

/**
 * Runs one unattended briefing and returns what it produced.
 *
 * Deliberately returns rather than persists a "briefing" row: what it produced
 * already lives in `campaigns`, `reorder_requests` and `audit_logs`, and a
 * fourth copy of the same facts is a fourth thing to keep in step.
 */
export async function runMerchantBriefing(
  ctx: AgentContext
): Promise<BriefingResult> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, ctx.merchantId),
  });

  const tools = merchantToolSet(ctx);

  const result = await generateText({
    instructions: `${BRIEFING_PROMPT}\n\nThe store is ${merchant?.businessName ?? "this shop"}.`,
    messages: [
      {
        content:
          "Give me the overnight briefing for this store. Today is " +
          new Date().toDateString() +
          ".",
        role: "user",
      },
    ],
    model: chatModel(),
    repairToolCall: repairHarmonyToolName<typeof tools>(),
    stopWhen: isStepCount(MAX_STEPS),
    /*
     * The same approval policy the interactive agent uses, unchanged. Reusing
     * it rather than writing an "unattended" variant is the point: there is
     * one definition of what needs a human, and the unattended path cannot
     * drift from it because it is not a separate path.
     */
    toolApproval: merchantApproval(ctx),
    tools,
  });

  const toolsUsed = result.steps.flatMap((step) =>
    (step.toolCalls ?? []).map((call) => call.toolName)
  );

  const executed = new Set(
    result.steps.flatMap((step) =>
      (step.toolResults ?? []).map((call) => call.toolName)
    )
  );

  const blockedTools = [
    ...new Set(toolsUsed.filter((name) => !executed.has(name))),
  ];

  const outputs = (name: string) =>
    result.steps
      .flatMap((step) => step.toolResults ?? [])
      .filter((row) => row.toolName === name)
      .map((row) => row.output);

  const draftedCampaigns = outputs("draftCampaign").filter(
    (row) => (row as { drafted?: boolean }).drafted === true
  ).length;

  const raisedReorders = outputs("createReorderRequest").filter(
    (row) => (row as { created?: boolean }).created === true
  ).length;

  await recordAudit({
    action: AuditAction.BRIEFING_RUN,
    actorId: ctx.actor.userId ?? ctx.actor.identifier,
    actorType: "ai_assistant",
    explanation:
      `Ran the overnight briefing. Drafted ${draftedCampaigns} campaign(s) and raised ${raisedReorders} reorder request(s). ` +
      "Nothing is live; everything waits for the merchant." +
      (blockedTools.length > 0
        ? ` Suspended without executing: ${blockedTools.join(", ")}.`
        : ""),
    merchantId: ctx.merchantId,
    metadata: {
      blockedTools,
      draftedCampaigns,
      raisedReorders,
      // The flag that separates "while I was asleep" from "because I asked".
      scheduled: true,
      toolsUsed,
    },
  });

  return {
    blockedTools,
    draftedCampaigns,
    raisedReorders,
    text: result.text,
    toolsUsed,
  };
}
