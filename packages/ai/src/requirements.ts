import {
  agentDb,
  type BuildRequirements,
  buildRequirements,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export type { BuildRequirements } from "@workspace/db";

import type { AgentContext } from "./context";

/**
 * The requirement interview, as state.
 *
 * §3.2 asks for two things that pull against each other: discover what the
 * buyer needs, and do not ask unnecessary questions. Both are unenforceable
 * while the answers live only in the transcript — the model re-derives the
 * budget from prose on every turn, and nothing can tell whether a question has
 * already been answered.
 *
 * Holding the answers in a row turns "ask only for what is still missing" into
 * a null check, which is why `missingFields` exists and why the prompt is told
 * to consult it rather than to use its judgement.
 */

/** The fields an interview can fill, in the order worth asking them. */
const FIELD_LABELS: { field: keyof BuildRequirements; question: string }[] = [
  { field: "budgetPaise", question: "their budget" },
  { field: "useCase", question: "what they will mainly use it for" },
  { field: "targetResolution", question: "the resolution they play at" },
  { field: "targetRefreshHz", question: "the refresh rate they want to hit" },
  { field: "workloads", question: "which games or software specifically" },
  { field: "ownedParts", question: "any parts they already own" },
  { field: "constraints", question: "any size, noise or platform constraints" },
];

export interface RequirementInput {
  budgetPaise?: number | null;
  constraints?: Record<string, unknown> | null;
  ownedParts?: Record<string, unknown> | null;
  targetRefreshHz?: number | null;
  targetResolution?: string | null;
  useCase?: string | null;
  workloads?: string[] | null;
}

export async function getRequirements(
  ctx: AgentContext
): Promise<BuildRequirements | null> {
  const row = await agentDb.query.buildRequirements.findFirst({
    where: eq(buildRequirements.conversationId, ctx.conversationId),
  });

  return row ?? null;
}

/**
 * Merges what the buyer just said into what was already known.
 *
 * A merge rather than a replace, and undefined is skipped while explicit null
 * clears: a turn that mentions only the budget must not wipe the resolution
 * captured three turns ago. That is the difference between a running interview
 * and a form the buyer has to fill in every time they speak.
 */
export async function captureRequirements(
  ctx: AgentContext,
  input: RequirementInput
): Promise<BuildRequirements> {
  const patch = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );

  const existing = await getRequirements(ctx);

  if (existing) {
    const [updated] = await agentDb
      .update(buildRequirements)
      .set(patch)
      .where(eq(buildRequirements.conversationId, ctx.conversationId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update the captured requirements");
    }

    return updated;
  }

  const [created] = await agentDb
    .insert(buildRequirements)
    .values({ ...patch, conversationId: ctx.conversationId })
    .returning();

  if (!created) {
    throw new Error("Failed to record the captured requirements");
  }

  return created;
}

/**
 * What is still unknown, phrased as things to ask.
 *
 * Returned to the model so §3.2's "avoid unnecessary questions" is a fact it
 * is handed rather than a rule it has to remember. Asking about a field that
 * is not on this list is asking twice.
 */
export function missingFields(
  requirements: BuildRequirements | null
): string[] {
  if (!requirements) {
    return FIELD_LABELS.map((entry) => entry.question);
  }

  return FIELD_LABELS.filter((entry) => {
    const value = requirements[entry.field];

    return value === null || value === undefined;
  }).map((entry) => entry.question);
}

/**
 * Whether enough is known to recommend at all.
 *
 * A budget and a use case are the two that change every downstream choice; the
 * rest refine it. Recommending without them is guessing, and §3.1 says not to.
 */
export function canRecommend(requirements: BuildRequirements | null): boolean {
  return Boolean(requirements?.budgetPaise && requirements?.useCase);
}

/** A short line for the prompt, so the interview state survives the turn. */
export function describeRequirements(
  requirements: BuildRequirements | null
): string {
  if (!requirements) {
    return "Nothing has been captured yet.";
  }

  const parts: string[] = [];

  if (requirements.budgetPaise) {
    parts.push(
      `budget ₹${(requirements.budgetPaise / 100).toLocaleString("en-IN")}`
    );
  }

  if (requirements.useCase) {
    parts.push(`use: ${requirements.useCase}`);
  }

  if (requirements.targetResolution) {
    parts.push(
      `target: ${requirements.targetResolution}${requirements.targetRefreshHz ? ` at ${requirements.targetRefreshHz}Hz` : ""}`
    );
  }

  if (requirements.workloads?.length) {
    parts.push(`workloads: ${requirements.workloads.join(", ")}`);
  }

  return parts.length > 0 ? parts.join("; ") : "Nothing has been captured yet.";
}
