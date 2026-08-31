import {
  agentDb,
  conversationMessages,
  conversations,
  reasoningLogs,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import type { AgentContext } from "./context";

/**
 * Writers for the conversation, message and reasoning tables.
 *
 * Nothing here may throw into the agent loop: an unwritable log must never cost
 * a buyer their checkout, so failures are reported and swallowed — the same
 * contract `recordAudit` follows in `@workspace/payments`.
 */

async function safely(label: string, write: () => Promise<unknown>) {
  try {
    await write();
  } catch (error) {
    console.error(`Failed to persist ${label}`, error);
  }
}

export function persistUserMessage(
  ctx: AgentContext,
  content: string
): Promise<void> {
  return safely("user message", () =>
    agentDb.insert(conversationMessages).values({
      content,
      conversationId: ctx.conversationId,
      role: "user",
    })
  );
}

export function persistAssistantMessage(
  ctx: AgentContext,
  content: string,
  toolCalls?: unknown
): Promise<void> {
  if (!(content.trim() || toolCalls)) {
    return Promise.resolve();
  }

  return safely("assistant message", () =>
    agentDb.insert(conversationMessages).values({
      content,
      conversationId: ctx.conversationId,
      role: "assistant",
      toolCalls: toolCalls ?? null,
    })
  );
}

export interface ReasoningStep {
  /** Which tools ran, so the trail shows action and not just narration. */
  actionTaken: string;
  confidence: number;
  stepNumber: number;
  thoughtSummary: string;
}

export function persistReasoningStep(
  ctx: AgentContext,
  step: ReasoningStep
): Promise<void> {
  return safely("reasoning step", () =>
    agentDb.insert(reasoningLogs).values({
      actionTaken: step.actionTaken,
      confidence: step.confidence,
      conversationId: ctx.conversationId,
      stepNumber: step.stepNumber,
      thoughtSummary: step.thoughtSummary,
    })
  );
}

export function touchConversation(ctx: AgentContext): Promise<void> {
  return safely("conversation timestamp", () =>
    agentDb
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, ctx.conversationId))
  );
}

/** Full stored transcript, for the audit view. */
export function getTranscript(conversationId: string) {
  return agentDb
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));
}

export function getReasoningChain(conversationId: string) {
  return agentDb
    .select()
    .from(reasoningLogs)
    .where(eq(reasoningLogs.conversationId, conversationId))
    .orderBy(asc(reasoningLogs.stepNumber));
}
