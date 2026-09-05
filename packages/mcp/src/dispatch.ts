import {
  type AgentContext,
  builderTools,
  checkoutTools,
  merchantTools,
  shoppingTools,
} from "@workspace/ai";
import type { McpCapability, ToolSetName } from "./capabilities";

/**
 * Running a capability.
 *
 * Split from `./capabilities` so the table of what each scope may reach stays
 * free of anything that touches a database or a model. That table is the
 * security-relevant part of this package; it should be readable, and testable,
 * on its own.
 *
 * Every capability delegates to the tool the in-app agent already calls. There
 * is no second implementation to drift out of step with the first, and no
 * second place to fix a grounding bug.
 */

const TOOL_SETS: Record<
  ToolSetName,
  (ctx: AgentContext) => Record<string, unknown>
> = {
  builder: builderTools,
  checkout: checkoutTools,
  merchant: merchantTools,
  shopping: shoppingTools,
};

/**
 * The AI SDK leaves `execute` optional because a tool may be client-executed.
 * Every tool reached here has one, and a missing implementation is a wiring
 * mistake worth failing loudly on rather than handling politely at runtime.
 */
export async function runCapability(
  capability: McpCapability,
  ctx: AgentContext,
  input: unknown
): Promise<unknown> {
  const tools = TOOL_SETS[capability.tool.set](ctx);

  const tool = tools[capability.tool.name] as
    | { execute?: (input: unknown, options?: unknown) => Promise<unknown> }
    | undefined;

  if (!tool?.execute) {
    throw new Error(
      `${capability.name} names ${capability.tool.set}.${capability.tool.name}, which has no executable implementation`
    );
  }

  return await tool.execute(input, {
    messages: [],
    toolCallId: crypto.randomUUID(),
  });
}
