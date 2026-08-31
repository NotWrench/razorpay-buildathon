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
import { type PageContextInput, resolvePageContext } from "../page-context";
import {
  persistAssistantMessage,
  persistReasoningStep,
  persistUserMessage,
  touchConversation,
} from "../persistence";
import { approvalSigningSecret, chatModel } from "../provider";
import { toolCallRecorder } from "../telemetry";
import { builderTools } from "../tools/builder";
import { checkoutTools } from "../tools/checkout";
import { explainTools } from "../tools/explain";
import { requirementTools } from "../tools/requirements";
import { shoppingTools } from "../tools/shopping";
import { storefrontApproval } from "./approval";
import { activeToolsFor, type ChatMode, modeInstructions } from "./modes";
import { storefrontPrompt } from "./prompts";
import { summariseStep } from "./steps";

/** Every tool the buyer-facing agent can reach. */
export function storefrontToolSet(ctx: AgentContext) {
  return {
    ...shoppingTools(ctx),
    ...builderTools(ctx),
    ...requirementTools(ctx),
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

// A build is several tool calls before a word is said: search, check, save,
// add to cart. Eight steps left no room to actually answer afterwards.
const MAX_STEPS = 12;

/**
 * Runs one turn of the shopping agent and returns a UI message stream.
 *
 * The turn is persisted as it goes: the buyer's message up front, a reasoning
 * row per step, and the assistant's reply at the end. A logging failure never
 * breaks the stream.
 */
export async function streamStorefrontTurn(params: {
  context?: PageContextInput;
  ctx: AgentContext;
  messages: StorefrontMessage[];
  mode?: ChatMode;
}): Promise<Response> {
  const { ctx, messages, mode } = params;

  const merchant = await getMerchantBySlug(ctx.storeSlug);
  const memories = await recallMemories(ctx);
  const pageContext = await resolvePageContext(ctx, params.context);

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
    activeTools: activeToolsFor(mode) as (keyof typeof tools)[] | undefined,
    experimental_toolApprovalSecret: approvalSigningSecret(),
    instructions: storefrontPrompt({
      memorySummary: describeMemories(memories),
      modeInstructions: modeInstructions(mode),
      pageContext: pageContext?.description,
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
    // §24's per-call telemetry. Hooked into the loop rather than wrapped
    // around each tool, so a tool cannot be added that escapes it.
    onToolExecutionEnd: toolCallRecorder({
      agentType: "customer",
      ctx,
      mode,
    }),
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
