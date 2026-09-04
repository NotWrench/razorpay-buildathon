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
import { describeMerchantView, type MerchantView } from "../page-context";
import {
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  touchConversation,
} from "../persistence";
import { approvalSigningSecret, chatModel } from "../provider";
import { toolCallRecorder } from "../telemetry";
import { campaignTools } from "../tools/campaigns";
import { explainTools } from "../tools/explain";
import { merchantTools } from "../tools/merchant";
import { merchantApproval } from "./approval";
import { merchantPrompt } from "./prompts";
import { cleanMessageHistory, repairHarmonyToolName } from "./repair";
import { summariseStep } from "./steps";
import { describeTurnFailure, reportAbortAsError, turnSignal } from "./turn";

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
  /** The request's signal, so closing the tab stops the model. */
  abortSignal?: AbortSignal;
  ctx: AgentContext;
  messages: MerchantMessage[];
  /** Which window the merchant has open on the briefing screen. */
  view?: MerchantView;
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
    // A turn that never ends is indistinguishable from one still working. See
    // `agents/turn.ts`.
    abortSignal: turnSignal(params.abortSignal),
    experimental_toolApprovalSecret: approvalSigningSecret(),
    instructions: merchantPrompt({
      pageContext: describeMerchantView(params.view) ?? undefined,
      storeName: merchant?.businessName ?? "your store",
    }),
    messages: await convertToModelMessages(cleanMessageHistory(messages)),
    model: chatModel(),
    onAbort: async ({ steps }) => {
      // `onFinish` does not run on an abort, so without this a turn stopped by
      // the deadline vanishes from the transcript and the audit trail — the
      // §24 record would be missing exactly the turns worth investigating.
      await persistAssistantMessage(
        ctx,
        "",
        steps.flatMap((step) => step.toolCalls ?? [])
      );
      await touchConversation(ctx);
    },
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
    onToolExecutionEnd: toolCallRecorder({ agentType: "admin", ctx }),
    repairToolCall: repairHarmonyToolName<ReturnType<typeof merchantToolSet>>(),
    stopWhen: isStepCount(MAX_STEPS),
    toolApproval: merchantApproval(ctx),
    tools: merchantToolSet(ctx),
  });

  return createUIMessageStreamResponse({
    headers: { "x-conversation-id": ctx.conversationId },
    stream: reportAbortAsError(
      toUIMessageStream({
        onError: (error) => {
          console.error("Merchant turn failed", error);

          return describeTurnFailure(error);
        },
        /*
         * Shown for the same reason as on the storefront, and with more force:
         * a merchant is being told to discount stock or reorder against a
         * forecast, and the working behind that number is what makes it
         * arguable rather than something to take on faith.
         */
        sendReasoning: true,
        stream: result.stream,
      })
    ),
  });
}
