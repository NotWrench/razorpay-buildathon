import { isToolUIPart, type UIMessage } from "ai";

/**
 * When a suspended turn should be handed back to the model.
 *
 * The agent loop stops mid-turn for two different reasons, and the storefront
 * thread has both. A money action stops for an *approval* — the tool has not
 * run and is waiting to be allowed to. `askBuyer` stops for an *answer* —
 * there is no server-side execute at all, and the buyer's tap is the tool's
 * output.
 *
 * The SDK ships a predicate for each, and neither is sufficient alone.
 * `lastAssistantMessageIsCompleteWithApprovalResponses` requires at least one
 * approval response, so a turn that only asked a question never resumes and
 * the answer disappears into a thread that has stopped listening.
 * `lastAssistantMessageIsCompleteWithToolCalls` accepts only `output-available`
 * and `output-error`, so an approved money action — which sits at
 * `approval-responded` — never resumes either. Using both with an `or` is
 * worse than either: each would fire while the other's gate was still open,
 * resuming a turn with a question still unanswered on screen.
 *
 * So the condition is stated once, over the whole step: a person answered
 * something, and every tool the model started has reached an end it can read.
 */

/** Tool states the model can act on. Anything else is still in flight. */
const SETTLED = new Set([
  "approval-responded",
  "output-available",
  "output-denied",
  "output-error",
]);

/**
 * Tools with no server-side execute, whose output can only have come from the
 * buyer. Keep in step with the tools defined without `execute` in
 * `packages/ai/src/tools`.
 */
const CLIENT_TOOLS = new Set(["tool-askBuyer"]);

/**
 * Whether a person is what unblocked this step.
 *
 * Settledness alone is not enough to justify resuming. A turn that runs into
 * the server's step cap ends with its last step full of ordinary, settled,
 * server-executed tool calls — and resuming on those sends a turn the buyer
 * did not ask for, which runs into the cap again, which resumes again. The old
 * approval-only predicate could not do this, because an approval is by
 * definition something a person answered. The same standard holds here.
 */
function answeredByPerson(part: { state: string; type: string }): boolean {
  /* Settledness is the caller's check; this one is only about provenance. */
  return part.state === "approval-responded" || CLIENT_TOOLS.has(part.type);
}

export function lastAssistantTurnIsAnswered<TMessage extends UIMessage>({
  messages,
}: {
  messages: TMessage[];
}): boolean {
  const message = messages.at(-1);

  if (message?.role !== "assistant") {
    return false;
  }

  /*
   * Only the current step counts. A turn that searched, then asked, then
   * searched again holds settled tool parts from the earlier steps; judging
   * the whole message would resume on those and cut the question short.
   */
  const lastStepStart = message.parts.reduce(
    (last, part, index) => (part.type === "step-start" ? index : last),
    -1
  );

  const tools = message.parts
    .slice(lastStepStart + 1)
    .filter(isToolUIPart)
    /* The provider resolves these itself; they are never ours to wait on. */
    .filter((part) => !part.providerExecuted);

  return (
    tools.some(answeredByPerson) &&
    tools.every((part) => SETTLED.has(part.state))
  );
}
