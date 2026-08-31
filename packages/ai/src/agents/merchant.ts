import { db, merchants } from "@workspace/db";
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
import { eq } from "drizzle-orm";
import type { AgentContext } from "../context";
import {
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  touchConversation,
} from "../persistence";
import { approvalSigningSecret, chatModel } from "../provider";
import { campaignTools } from "../tools/campaigns";
import { explainTools } from "../tools/explain";
import { merchantTools } from "../tools/merchant";
import { merchantApproval } from "./approval";
import { merchantPrompt } from "./prompts";
import { summariseStep } from "./steps";

export function merchantToolSet(ctx: AgentContext) {
  return {
    ...merchantTools(ctx),
    ...campaignTools(ctx),
    ...explainTools(ctx),
  };
}

export type MerchantTools = ReturnType<typeof merchantToolSet>;
export type MerchantUITools = InferUITools<MerchantTools>;
export type MerchantMessage = UIMessage<never, UIDataTypes, MerchantUITools>;

const MAX_STEPS = 10;

/** Runs one turn of the merchant assistant and returns a UI message stream. */
export async function streamMerchantTurn(params: {
  ctx: AgentContext;
  messages: MerchantMessage[];
}): Promise<Response> {
  const { ctx, messages } = params;

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, ctx.merchantId),
  });

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

  const result = streamText({
    experimental_toolApprovalSecret: approvalSigningSecret(),
    instructions: merchantPrompt({
      storeName: merchant?.businessName ?? "your store",
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
    toolApproval: merchantApproval(ctx),
    tools: merchantToolSet(ctx),
  });

  return createUIMessageStreamResponse({
    headers: { "x-conversation-id": ctx.conversationId },
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
