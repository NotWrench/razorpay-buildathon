import { type ToolSet, tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";
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
 */
export function requirementTools(ctx: AgentContext) {
  return {
    captureRequirements: tool({
      description:
        "Record what the buyer has told you about their needs. Call this as " +
        "soon as they say something concrete — a budget, a game, a resolution " +
        "— rather than waiting until the end. Pass only the fields they " +
        "actually mentioned; anything you omit is left as it was.",
      execute: async (input) => {
        const saved = await captureRequirements(ctx, input);

        const stillMissing = missingFields(saved);

        return {
          captured: {
            budgetPaise: saved.budgetPaise,
            constraints: saved.constraints,
            ownedParts: saved.ownedParts,
            targetRefreshHz: saved.targetRefreshHz,
            targetResolution: saved.targetResolution,
            useCase: saved.useCase,
            workloads: saved.workloads,
          },
          enoughToRecommend: canRecommend(saved),
          stillMissing,
        };
      },
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
        "already been answered, and asking again wastes their time.",
      execute: async () => {
        const requirements = await getRequirements(ctx);

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
          enoughToRecommend: canRecommend(requirements),
          stillMissing: missingFields(requirements),
        };
      },
      inputSchema: z.object({}),
    }),
  } satisfies ToolSet;
}
