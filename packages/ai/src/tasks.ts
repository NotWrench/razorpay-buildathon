import {
  type AgentFeedback,
  type AgentTask,
  agentDb,
  agentFeedback,
  agentTasks,
  aiRecommendations,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { AgentContext } from "./context";

/**
 * Tasks and feedback.
 *
 * A conversation is a transcript. A task is an intent with an outcome, and
 * §24's question — did the agent actually help — is only answerable from the
 * second: a shopper who asked for a build and left without one had a
 * conversation that looks entirely healthy by every other measure in this
 * database.
 *
 * Feedback is the only signal here that does not come from the agent, which
 * makes it the only one that can contradict it. A recommendation the model
 * scored 0.9 and the buyer thumbed down is the interesting row.
 */

export interface OpenTaskInput {
  intent: string;
  mode?: string | null;
}

/**
 * Opens a task, or returns the one already open.
 *
 * One open task per conversation. A buyer who changes direction mid-chat is
 * not starting a second task in parallel — they are ending one and beginning
 * another, and closing the first is what makes the outcome legible.
 */
export async function openTask(
  ctx: AgentContext,
  input: OpenTaskInput
): Promise<AgentTask> {
  const existing = await agentDb.query.agentTasks.findFirst({
    where: and(
      eq(agentTasks.conversationId, ctx.conversationId),
      eq(agentTasks.state, "open")
    ),
  });

  if (existing) {
    return existing;
  }

  const [created] = await agentDb
    .insert(agentTasks)
    .values({
      conversationId: ctx.conversationId,
      intent: input.intent,
      mode: input.mode ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to open the task");
  }

  return created;
}

export type TaskOutcome = "resolved" | "abandoned" | "handed_off" | "failed";

/**
 * Closes the open task with how it actually ended.
 *
 * `abandoned` is a first-class outcome rather than an absence. A task left
 * open forever is indistinguishable from one nobody recorded, and the
 * difference between "the buyer gave up" and "we never looked" is the whole
 * value of the table.
 */
export async function closeTask(
  ctx: AgentContext,
  outcome: TaskOutcome,
  detail?: string
): Promise<AgentTask | null> {
  const [closed] = await agentDb
    .update(agentTasks)
    .set({
      outcome,
      outcomeDetail: detail ?? null,
      state: "closed",
    })
    .where(
      and(
        eq(agentTasks.conversationId, ctx.conversationId),
        eq(agentTasks.state, "open")
      )
    )
    .returning();

  return closed ?? null;
}

export async function getOpenTask(
  ctx: AgentContext
): Promise<AgentTask | null> {
  const task = await agentDb.query.agentTasks.findFirst({
    where: and(
      eq(agentTasks.conversationId, ctx.conversationId),
      eq(agentTasks.state, "open")
    ),
  });

  return task ?? null;
}

export interface FeedbackInput {
  note?: string | null;
  /** The recommendation being judged, when the feedback is about one. */
  recommendationId?: string | null;
  thumbs: "up" | "down";
}

/**
 * Records what the person thought.
 *
 * A `recommendationId` that does not belong to this conversation is dropped
 * rather than stored: feedback arrives from a client, and a row pointing at
 * somebody else's recommendation would quietly corrupt the one measure here
 * that is supposed to be independent of the agent.
 */
export async function recordFeedback(
  ctx: AgentContext,
  input: FeedbackInput
): Promise<AgentFeedback> {
  let recommendationId: string | null = null;

  if (input.recommendationId) {
    const owned = await agentDb.query.aiRecommendations.findFirst({
      where: and(
        eq(aiRecommendations.id, input.recommendationId),
        eq(aiRecommendations.conversationId, ctx.conversationId)
      ),
    });

    recommendationId = owned ? owned.id : null;
  }

  const [created] = await agentDb
    .insert(agentFeedback)
    .values({
      conversationId: ctx.conversationId,
      note: input.note ?? null,
      recommendationId,
      thumbs: input.thumbs,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to record the feedback");
  }

  // Accepting a recommendation is a fact about the recommendation, so it is
  // written back where the recommendation lives rather than inferred by a
  // join every time somebody asks.
  if (recommendationId && input.thumbs === "up") {
    await agentDb
      .update(aiRecommendations)
      .set({ accepted: true })
      .where(eq(aiRecommendations.id, recommendationId));
  }

  return created;
}
