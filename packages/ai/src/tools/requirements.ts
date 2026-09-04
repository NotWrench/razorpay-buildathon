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
/**
 * The most answers a question may offer.
 *
 * Six is where a row of pills stops being a glance and starts being a menu. A
 * model that wants to offer ten options has not narrowed the question enough,
 * and the cap makes it do that work rather than pushing it onto the buyer.
 */
const MAX_CHOICES = 6;

export function requirementTools(ctx: AgentContext) {
  return {
    /**
     * A question, asked as something the buyer can tap.
     *
     * This tool has no `execute`, and that is the entire point: the SDK
     * forwards it to the client, suspends the loop, and resumes when the
     * answer comes back as the tool's output. The model is genuinely waiting
     * for the buyer rather than guessing on their behalf.
     *
     * It exists because the question set used to be a hardcoded array in the
     * browser — five questions, fixed wording, fixed order, model never
     * consulted. That is fine right up until somebody wants a machine for
     * flight simulation, at which point the interview asks about refresh rate
     * and the one question worth asking is never put. The model knows what to
     * ask next; what it lacked was a way to ask it that the buyer could
     * answer with a thumb.
     *
     * The prompt does the narrowing: one of these per turn, and only when the
     * answer would actually change the recommendation.
     */
    askBuyer: tool({
      description:
        "Ask the buyer ONE question and offer the answers as tappable " +
        "options. Use this instead of writing the question as prose whenever " +
        "the answer is a budget, a pick from a short list, or a few things " +
        "off a list. Write the prompt and the option labels yourself, in your " +
        "own words, for this buyer. The composer stays live, so they may " +
        "ignore the options and type something else — expect that. Ask only " +
        "what would change your recommendation, and call captureRequirements " +
        "with the answer once it comes back.",
      inputSchema: z.object({
        choices: z
          .array(
            z.object({
              label: z
                .string()
                .max(40)
                .describe(
                  "What the pill reads. A short phrase to tap — no prices."
                ),
              value: z
                .string()
                .max(60)
                .describe("What you want back when it is tapped."),
            })
          )
          .max(MAX_CHOICES)
          .optional()
          .describe("Required for kind 'choice' and 'multi'. Two to six."),
        field: z
          .string()
          .max(40)
          .describe(
            "Which requirement this fills, for your own reference on the " +
              "next turn: budget, useCase, targetResolution, targetRefreshHz, " +
              "workloads, ownedParts or constraints."
          ),
        kind: z
          .enum(["choice", "multi", "range"])
          .describe(
            "'choice' picks one, 'multi' picks several, 'range' drags a " +
              "number. Anything that needs a sentence back should be asked " +
              "as ordinary text in your reply instead of with this tool."
          ),
        label: z
          .string()
          .max(24)
          .describe('The answer\'s heading once given, e.g. "Budget".'),
        prompt: z
          .string()
          .max(200)
          .describe("The question itself, in your words. One sentence."),
        range: z
          .object({
            max: z.number(),
            min: z.number(),
            step: z.number().positive(),
            unit: z
              .string()
              .max(8)
              .optional()
              .describe('Rendered against the number, e.g. "₹".'),
          })
          .optional()
          .describe("Required for kind 'range'. Rupees, not paise."),
      }),
      /*
       * Declared even though nothing here validates it: the output is produced
       * by the browser, so this is the only place the answer's shape is
       * written down for both sides to agree on.
       */
      outputSchema: z
        .string()
        .describe("What the buyer answered, in their own words."),
    }),

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
