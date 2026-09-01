import { type ToolSet, tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";
import type { BuildRequirements } from "../requirements";
import {
  canRecommend,
  captureRequirements,
  getRequirements,
  missingFields,
} from "../requirements";

/**
 * The requirement interview.
 *
 * Two tools, and the interesting one is `getRequirements`: it returns what is
 * still unknown, so §3.2's "avoid unnecessary questions" is a list the model
 * is handed rather than a rule it has to keep in mind across eight turns.
 *
 * Both tools return `nextStep` rather than leaving the model to weigh
 * `enoughToRecommend` against `stillMissing`. Those two read as contradictory
 * — one says "you may proceed", the other offers four things to ask about —
 * and a model that follows instructions literally resolves the tie by
 * interviewing the buyer instead of showing them anything, which is precisely
 * the behaviour §3.2 forbids. Deciding it here means the answer cannot depend
 * on which of two prompt lines the model weighted more heavily.
 */

/** The shared shape both tools return, so the contract cannot drift apart. */
function requirementState(requirements: BuildRequirements | null) {
  const enough = canRecommend(requirements);
  const unanswered = missingFields(requirements);

  return {
    captured: requirements
      ? {
          budgetPaise: requirements.budgetPaise,
          constraints: requirements.constraints,
          ownedParts: requirements.ownedParts,
          targetRefreshHz: requirements.targetRefreshHz,
          targetResolution: requirements.targetResolution,
          useCase: requirements.useCase,
          workloads: requirements.workloads,
        }
      : null,
    enoughToRecommend: enough,
    /** What to do now. `recommend` means stop interviewing and go find parts. */
    nextStep: enough ? ("recommend" as const) : ("ask" as const),
    /**
     * Unanswered fields that are worth refining on a later turn, once the
     * buyer has seen something. Never a list to read out as questions.
     */
    refineLater: enough ? unanswered : [],
    /**
     * What to ask the buyer, right now — and empty once there is enough to
     * recommend, because at that point the answer is to show them parts.
     *
     * Handing back a populated question list while `nextStep` says
     * `recommend` is a contradiction, and a model resolves it by asking:
     * observed behaviour was to search, find three cards the buyer could
     * have bought, and then request a refresh rate instead of naming one.
     * §3.2 is explicit that this is the wrong trade, so the list empties.
     */
    stillMissing: enough ? [] : unanswered,
  };
}
export function requirementTools(ctx: AgentContext) {
  return {
    captureRequirements: tool({
      description:
        "Record what the buyer has told you about their needs. Call this as " +
        "soon as they say something concrete — a budget, a game, a resolution " +
        "— rather than waiting until the end. Pass only the fields they " +
        "actually mentioned; anything you omit is left as it was.",
      execute: async (input) =>
        requirementState(await captureRequirements(ctx, input)),
      inputSchema: z.object({
        budgetPaise: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "What they said they can spend, in paise. ₹80,000 is 8000000."
          ),
        constraints: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Hard limits in their own terms, e.g. { "formFactor": "must be small", "noise": "quiet" }.'
          ),
        ownedParts: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Parts they already have and want to keep, e.g. { "monitor": "1440p 165Hz" }.'
          ),
        targetRefreshHz: z.number().int().positive().max(1000).optional(),
        targetResolution: z
          .string()
          .max(40)
          .optional()
          .describe('As they said it: "1080p", "1440p", "4K".'),
        useCase: z
          .string()
          .max(200)
          .optional()
          .describe("Gaming, editing, development, office work, mixed."),
        workloads: z
          .array(z.string().max(120))
          .max(12)
          .optional()
          .describe("Named games or software. Specifics beat categories."),
      }),
    }),

    getRequirements: tool({
      description:
        "What the buyer has already told you, and what is still unknown. Call " +
        "this before asking a question — anything not in stillMissing has " +
        "already been answered, and asking again wastes their time. When " +
        "nextStep is 'recommend' the interview is over: go and find parts.",
      execute: async () => requirementState(await getRequirements(ctx)),
      inputSchema: z.object({}),
    }),
  } satisfies ToolSet;
}
