import { type ToolSet, tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";
import { paiseToRupees, rupeesToPaise } from "../money";
import type { BuildRequirements } from "../requirements";
import {
  canRecommend,
  captureRequirements,
  getRequirements,
  missingFields,
} from "../requirements";
import { askBuyerInput, captureRequirementsInput } from "./ask-buyer-schema";

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
          /*
           * Rupees, because rupees are what the tools take. Handing paise back
           * would put the model straight into the conversion that cost a build
           * its budget — see `ask-buyer-schema.ts`.
           */
          budgetRupees:
            requirements.budgetPaise === null
              ? null
              : paiseToRupees(requirements.budgetPaise),
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
      inputSchema: askBuyerInput,
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
      execute: async ({ budgetRupees, ...rest }) =>
        requirementState(
          await captureRequirements(ctx, {
            ...rest,
            /*
             * Converted here, never by the model. Asked for paise it turned a
             * ₹1,25,000 budget into ₹12,500, and the build came back cheap
             * with nothing to show that anything had gone wrong.
             */
            budgetPaise:
              budgetRupees === undefined
                ? undefined
                : rupeesToPaise(budgetRupees),
          })
        ),
      inputSchema: captureRequirementsInput,
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
