import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type InferUITools,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { type AgentContext, getMerchantBySlug } from "../context";
import { describeMemories, recallMemories } from "../memory";
import {
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  touchConversation,
} from "../persistence";
import { approvalSigningSecret, chatModel } from "../provider";
import { checkoutTools } from "../tools/checkout";
import { explainTools } from "../tools/explain";
import { shoppingTools } from "../tools/shopping";
import { storefrontApproval } from "./approval";
import { storefrontPrompt } from "./prompts";
import { summariseStep } from "./steps";

/** Every tool the buyer-facing agent can reach. */
export function storefrontToolSet(ctx: AgentContext) {
  return {
    ...shoppingTools(ctx),
    ...checkoutTools(ctx),
    ...explainTools(ctx),
  };
}

export type StorefrontTools = ReturnType<typeof storefrontToolSet>;
export type StorefrontUITools = InferUITools<StorefrontTools>;
export type StorefrontMessage = UIMessage<
  never,
  UIDataTypes,
  StorefrontUITools
>;

const MAX_STEPS = 8;

/**
 * Runs one turn of the shopping agent and returns a UI message stream.
 *
 * The turn is persisted as it goes: the buyer's message up front, a reasoning
 * row per step, and the assistant's reply at the end. A logging failure never
 * breaks the stream.
 */
export async function streamStorefrontTurn(params: {
  ctx: AgentContext;
  messages: StorefrontMessage[];
}): Promise<Response> {
  const { ctx, messages } = params;

  const merchant = await getMerchantBySlug(ctx.storeSlug);
  const memories = await recallMemories(ctx);

  const latest = messages.at(-1);

  if (latest?.role === "user") {
    const text = latest.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n");

    if (text) {
      await persistUserMessage(ctx, text);
    }
  }

  const tools = storefrontToolSet(ctx);

  const result = streamText({
    experimental_toolApprovalSecret: approvalSigningSecret(),
    instructions: storefrontPrompt({
      memorySummary: describeMemories(memories),
      storeName: merchant.businessName,
    }),
    messages: await convertToModelMessages(messages),
    model: chatModel(),
    onFinish: async ({ text, steps }) => {
      await persistAssistantMessage(
        ctx,
        text,
        steps.flatMap((step) => step.toolCalls ?? [])
      );
      await touchConversation(ctx);
    },
    onStepFinish: async (step) => {
      await persistReasoningStep(ctx, summariseStep(step));
    },
    stopWhen: isStepCount(MAX_STEPS),
    toolApproval: storefrontApproval(ctx),
    tools,
  });

  return createUIMessageStreamResponse({
    // The client echoes this back on the next turn so one shopping session is
    // one conversation in the audit trail, rather than a new row per message.
    headers: { "x-conversation-id": ctx.conversationId },
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
