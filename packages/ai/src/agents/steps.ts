import type { ReasoningStep } from "../persistence";

/**
 * Turns one agent step into a row for `reasoning_logs`.
 *
 * The stored thought is the model's own text plus the tools it actually
 * invoked, so the trail records what was *done*, not only what was said. A step
 * that called tools is scored higher than one that only narrated, because a
 * grounded step is more trustworthy than a fluent one.
 */

interface StepLike {
  stepNumber?: number;
  text?: string;
  toolCalls?: readonly { toolName: string }[];
}

const MAX_THOUGHT_LENGTH = 2000;

export function summariseStep(step: StepLike): ReasoningStep {
  const toolNames = (step.toolCalls ?? []).map((call) => call.toolName);

  const actionTaken =
    toolNames.length > 0 ? toolNames.join(", ") : "responded to the buyer";

  const narration = step.text?.trim();

  const thoughtSummary =
    narration && narration.length > 0
      ? narration.slice(0, MAX_THOUGHT_LENGTH)
      : `Called ${actionTaken}`;

  return {
    actionTaken,
    confidence: toolNames.length > 0 ? 0.9 : 0.6,
    stepNumber: (step.stepNumber ?? 0) + 1,
    thoughtSummary,
  };
}
