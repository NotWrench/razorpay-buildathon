import { NoSuchToolError, type ToolCallRepairFunction, type ToolSet } from "ai";

/**
 * Repairs tool calls that arrive with the model's own control tokens attached
 * to the tool name.
 *
 * `openai/gpt-oss-*` speaks Harmony, a format where the model marks which
 * channel it is writing to — `analysis` for its reasoning, `commentary` for
 * tool calls, `final` for the buyer. NVIDIA NIM's OpenAI-compatible adapter
 * parses that back into `tool_calls` for us, and intermittently takes too much
 * of the line with it, so the name arrives as:
 *
 *     searchProducts<|channel|>commentary
 *
 * The SDK then correctly reports a tool that does not exist, and the whole
 * turn dies over a punctuation error. It is not reliably reproducible — four
 * identical requests produced it once — which is exactly why it needs handling
 * in code rather than a model that promises not to do it.
 *
 * The repair is deliberately narrow. It strips the control tokens and accepts
 * the result only if it is an *exact* name in the tool set. There is no fuzzy
 * matching and no nearest-neighbour guess: half these tools create orders and
 * payment links, and quietly redirecting a malformed call into a money action
 * would be a far worse bug than the one being fixed. Anything that does not
 * resolve exactly is left to fail, visibly.
 */

/**
 * Everything from the first control token onwards.
 *
 * Harmony's tokens are `<|…|>`, so the first `<|` is where the tool name ended
 * and the model's own framing began.
 */
const CONTROL_TOKEN_TAIL = /<\|.*$/s;

/**
 * The `functions.` prefix Harmony uses to name a tool's recipient.
 *
 * Not seen in the wild here yet, but it is part of the same syntax and costs
 * one line to survive.
 */
const RECIPIENT_PREFIX = /^functions?\./;

export function cleanToolName(name: string): string {
  return name
    .replace(CONTROL_TOKEN_TAIL, "")
    .replace(RECIPIENT_PREFIX, "")
    .trim();
}

/**
 * Builds the `repairToolCall` handler for a tool set.
 *
 * Returning null hands the original error back, which is the right answer for
 * anything this cannot resolve honestly — the buyer sees a failed turn rather
 * than a tool nobody asked for.
 */
export function repairHarmonyToolName<
  TOOLS extends ToolSet,
>(): ToolCallRepairFunction<TOOLS> {
  return ({ error, toolCall, tools }) => {
    // Only a wrong *name* is repairable here. A malformed argument object is a
    // different failure with a different fix, and should not be swallowed by
    // this one.
    if (!NoSuchToolError.isInstance(error)) {
      return Promise.resolve(null);
    }

    const repaired = cleanToolName(toolCall.toolName);

    if (repaired === toolCall.toolName || !(repaired in tools)) {
      return Promise.resolve(null);
    }

    console.warn(
      `Repaired a tool name mangled by the model's control tokens: "${toolCall.toolName}" -> "${repaired}"`
    );

    return Promise.resolve({ ...toolCall, toolName: repaired });
  };
}
