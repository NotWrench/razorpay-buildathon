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
import { jsonSafeTools } from "../tools/json-safe";
import { requirementTools } from "../tools/requirements";
import { shoppingTools } from "../tools/shopping";
import { webSearchTools } from "../tools/web-search";
import { storefrontApproval } from "./approval";
import { activeToolsFor, type ChatMode, modeInstructions } from "./modes";
import { storefrontPrompt } from "./prompts";
import { cleanMessageHistory, repairHarmonyToolName } from "./repair";
import { summariseStep } from "./steps";
import { describeTurnFailure, reportAbortAsError, turnSignal } from "./turn";

/** Every tool the buyer-facing agent can reach. */
export function storefrontToolSet(ctx: AgentContext) {
  // JSON-safe for the same reason as the merchant's set: a tool output that is
  // not JSON kills the turn on the following model call, long after the tool
  // ran. See `tools/json-safe.ts`.
  return jsonSafeTools({
    ...shoppingTools(ctx),
    ...builderTools(ctx),
    ...requirementTools(ctx),
    ...checkoutTools(ctx),
    ...explainTools(ctx),
    ...webSearchTools(ctx),
  });
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
  /** The request's signal, so closing the tab stops the model. */
  abortSignal?: AbortSignal;
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
    // Without this the turn has no end. A hosted model that queues the request
    // holds the connection open, the stream stays empty, and the client shows
    // "Thinking…" forever — see `agents/turn.ts`.
    abortSignal: turnSignal(params.abortSignal),
    activeTools: activeToolsFor(mode) as (keyof typeof tools)[] | undefined,
    experimental_toolApprovalSecret: approvalSigningSecret(),
    instructions: storefrontPrompt({
      memorySummary: describeMemories(memories),
      modeInstructions: modeInstructions(mode),
      pageContext: pageContext?.description,
      storeName: merchant.businessName,
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
    // §24's per-call telemetry. Hooked into the loop rather than wrapped
    // around each tool, so a tool cannot be added that escapes it.
    onToolExecutionEnd: toolCallRecorder({
      agentType: "customer",
      ctx,
      mode,
    }),
    // A tool name arriving with the model's own control tokens stuck to it
    // should cost one repaired call, not the whole turn. See `repair.ts`.
    repairToolCall: repairHarmonyToolName<typeof tools>(),
    stopWhen: isStepCount(MAX_STEPS),
    toolApproval: storefrontApproval(ctx),
    tools,
  });

  return createUIMessageStreamResponse({
    // The client echoes this back on the next turn so one shopping session is
    // one conversation in the audit trail, rather than a new row per message.
    headers: { "x-conversation-id": ctx.conversationId },
    stream: reportAbortAsError(
      toUIMessageStream({
        // The SDK masks errors out of the stream unless this is supplied,
        // which is why a failed turn used to reach the buyer as silence.
        onError: (error) => {
          console.error("Storefront turn failed", error);

          return describeTurnFailure(error);
        },
        /*
         * The model's thinking, forwarded to the buyer. It defaults to off,
         * which is a sound default for a library and the wrong one here: this
         * agent reasons for far longer than it speaks — measured at 214
         * reasoning deltas against 27 of content — and a turn that shows only
         * the 27 reads as an answer arrived at without thought. What the
         * buyer is owed is not the tokens themselves but the evidence that
         * the machine weighed their budget against a real catalog.
         *
         * Nothing private travels here. The reasoning is about products and
         * prices the buyer can already see, and the tool results it reasons
         * over were fetched under the buyer's own scope.
         */
        sendReasoning: true,
        stream: result.stream,
      })
    ),
  });
}
