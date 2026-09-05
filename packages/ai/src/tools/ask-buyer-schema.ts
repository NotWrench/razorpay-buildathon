import { z } from "zod";
import { optional } from "./schema";

/**
 * What the interview tools accept, kept apart from the tools themselves.
 *
 * The shape of a question is a data contract and nothing more — it has no
 * business reaching the database, which is what importing it from the tool
 * module drags in. Separated, it can be exercised on its own, and these
 * shapes need exercising: every leniency below is a live turn that died, so
 * `test/ask-buyer-schema.test.ts` is the record of what the model actually
 * sends rather than a guess at what it might.
 *
 * The guiding line: `askBuyer` draws a row of pills. It moves no money and
 * reaches no catalogue, so there is nothing here for strictness to protect,
 * and every shape refused is a conversation lost for no benefit. The money
 * tools are strict for a reason and stay that way.
 */

/**
 * The most answers a question may offer.
 *
 * Six is where a row of pills stops being a glance and starts being a menu. A
 * model that wants to offer ten options has not narrowed the question enough,
 * and the cap makes it do that work rather than pushing it onto the buyer.
 */
export const MAX_CHOICES = 6;

/** An amount and, if it has one, the scale written after it. */
const AMOUNTS = /(\d[\d,]*(?:\.\d+)?)\s*(k|lakhs?|lacs?|l|crores?|cr)?/gi;

/** What each shorthand multiplies its number by. */
const SCALES: Record<string, number> = {
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
  k: 1000,
  l: 100_000,
  lac: 100_000,
  lacs: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
};

/**
 * The least a machine in this catalogue could plausibly cost.
 *
 * A floor, not a filter. Its job is to catch a number that came out of the
 * parse mangled — `"1L+"` read as one rupee — rather than to argue with a
 * buyer about what they can afford. Below this, the honest answer is that the
 * budget was not understood, and a failed turn the model retries beats a
 * build silently sized to a hundredth of what was asked for.
 */
const MIN_PLAUSIBLE_RUPEES = 1000;

/**
 * The most a machine in this catalogue could plausibly cost.
 *
 * A ceiling for the mirror-image mistake to the floor's: the model sending
 * paise in a field named rupees. A ₹4,00,000 budget forwarded as 40000000 is
 * multiplied again by `rupeesToPaise`, and ₹4 crore is both not a PC and
 * larger than the column it lands in — the turn died on a Postgres range
 * error the buyer saw as "the assistant hit an error".
 *
 * Fifty lakh is well past the most expensive machine that can be assembled
 * out of this catalogue, so nothing a buyer means is refused here; what is
 * refused is a number that cannot have been rupees.
 */
const MAX_PLAUSIBLE_RUPEES = 5_000_000;

/**
 * A budget in rupees, however the model chose to express it.
 *
 * It does not always send a number. When the buyer taps a bracket off a list
 * the model forwards the label — `"100001-120000"`, `"1L+"`, `"₹80k"` — and a
 * schema insisting on a number lost the turn in the moment right after the
 * buyer had answered, which is the worst possible time to fail.
 *
 * A bracket resolves to its top end. These come from a question about what the
 * buyer will spend *at most*, so the upper bound is the number they were
 * answering with; taking the lower one would quietly build them a cheaper
 * machine than they asked for.
 *
 * The shorthand matters more than it looks. The model writes its own option
 * labels, and left to itself it writes `15k` and `1L+` — so reading a bare
 * `1` out of `"1L+"` is not a hypothetical, and it is the one failure here
 * with no symptom: a budget a hundred thousand times too small still builds
 * a machine, just the wrong one. A string with no amount in it is refused
 * outright, because
 * inventing a number for "not sure yet" would put it in the buyer's mouth.
 */
export const budgetSchema = z
  .union([
    z.number().positive(),
    z.string().transform((said, ctx) => {
      const refuse = (why: string) => {
        ctx.addIssue({ code: "custom", message: why });

        return z.NEVER;
      };

      const amounts = [...said.matchAll(AMOUNTS)]
        .map(([, digits, scale]) => {
          /* The group is only optional to the type system; the match requires it. */
          const amount = Number((digits ?? "").replaceAll(",", ""));

          return amount * (scale ? (SCALES[scale.toLowerCase()] ?? 1) : 1);
        })
        .filter((value) => value > 0);

      if (amounts.length === 0) {
        return refuse(`No amount in "${said}"`);
      }

      const budget = Math.max(...amounts);

      if (budget < MIN_PLAUSIBLE_RUPEES) {
        return refuse(`"${said}" does not read as a budget in rupees`);
      }

      return budget;
    }),
  ])
  /*
   * Both ends checked after the union, because the number branch is where the
   * out-of-range budget actually arrived: the model sent 40000000 as a plain
   * number and nothing between the tool call and the column looked at it.
   */
  .refine(
    (rupees) =>
      rupees >= MIN_PLAUSIBLE_RUPEES && rupees <= MAX_PLAUSIBLE_RUPEES,
    {
      message:
        `A budget in rupees, between ${MIN_PLAUSIBLE_RUPEES} and ` +
        `${MAX_PLAUSIBLE_RUPEES}. Send rupees, not paise: ₹4,00,000 is 400000.`,
    }
  );

/**
 * One tappable answer, in any of the shapes the model actually sends.
 *
 * Three, in practice: the documented `{label, value}`, a `{label}` with the
 * value left off, and — most often — the bare string `"Gaming"`. All three say
 * the same thing, and only the first used to be accepted, so a question the
 * model had written perfectly well died in validation and the buyer was shown
 * a failed turn where five budget brackets should have been.
 */
export const choiceSchema = z.union([
  z.string().max(60),
  z.object({
    label: z
      .string()
      .max(40)
      .describe("What the pill reads. A short phrase to tap — no prices."),
    value: optional(z.string().max(60)).describe(
      "What you want back when it is tapped. Omit it and the label is used, " +
        "which is usually what you want."
    ),
  }),
]);

/**
 * The choices, canonical and capped.
 *
 * Capped by taking the first six rather than by refusing a seventh. Six is a
 * judgement about when a row of pills stops being a glance — a good reason to
 * show fewer, and a terrible reason to show none.
 */
export function toChoices(
  choices: z.infer<typeof choiceSchema>[]
): { label: string; value: string }[] {
  return choices
    .slice(0, MAX_CHOICES)
    .map((choice) =>
      typeof choice === "string"
        ? { label: choice, value: choice }
        : { label: choice.label, value: choice.value ?? choice.label }
    );
}

/** How many stops a slider gets when the model does not say. */
const SLIDER_STOPS = 100;

/**
 * A sensible step for a range that arrived without one.
 *
 * A hundred stops is fine enough to land on a number the buyer means and
 * coarse enough that dragging it is one gesture. Never zero: a step of zero
 * is a slider that cannot move, which is worse than a rounder number.
 */
export function stepFor({ max, min }: { max: number; min: number }): number {
  return Math.max(1, Math.round(Math.abs(max - min) / SLIDER_STOPS));
}

/**
 * The two ends of a slider, in either shape the model sends them.
 *
 * `{min, max}` is what the schema advertises and `[80000, 200000]` is what it
 * writes about a third of the time. The second is not a mistake worth failing
 * a turn over — a pair of numbers on a range is unambiguous, and the buyer
 * loses their question either way.
 *
 * `step` is filled in when it is missing, which is most of the time. The two
 * ends are the question; how far one nudge moves is a detail of the widget,
 * and the model is right not to think about it.
 */
const rangeSchema = z
  .union([
    z.object({
      max: z.number(),
      min: z.number(),
      step: optional(z.number().positive()).describe(
        "How far one nudge of the slider moves. Omit it and a hundredth of " +
          "the span is used."
      ),
      unit: optional(z.string().max(8)).describe(
        'Rendered against the number, e.g. "₹".'
      ),
    }),
    z.tuple([z.number(), z.number()]),
  ])
  .transform((range) => {
    const ends = Array.isArray(range)
      ? { max: Math.max(...range), min: Math.min(...range) }
      : { max: range.max, min: range.min, unit: range.unit };

    return {
      ...ends,
      step: (Array.isArray(range) ? undefined : range.step) ?? stepFor(ends),
    };
  });

/** Everything a question needs in order to be drawn. */
export const askBuyerInput = z.object({
  choices: optional(z.array(choiceSchema).transform(toChoices)).describe(
    "Required for kind 'choice' and 'multi'. Two to six. A plain string is a " +
      "choice whose label and value are the same, which is usually what you want."
  ),
  field: z
    .string()
    .max(40)
    .describe(
      "Which requirement this fills, for your own reference on the next " +
        "turn: budget, useCase, targetResolution, targetRefreshHz, " +
        "workloads, ownedParts or constraints."
    ),
  kind: z
    .enum(["choice", "multi", "range"])
    .describe(
      "'choice' picks one, 'multi' picks several, 'range' drags a number. " +
        "Anything that needs a sentence back should be asked as ordinary " +
        "text in your reply instead of with this tool."
    ),
  label: z
    .string()
    .max(24)
    .describe('The answer\'s heading once given, e.g. "Budget".'),
  prompt: z
    .string()
    .max(200)
    .describe("The question itself, in your words. One sentence."),
  range: optional(rangeSchema).describe(
    "Required for kind 'range'. Rupees, not paise. Two numbers — the low " +
      "end and the high end — are enough."
  ),
});

/**
 * What the buyer has told us, in the units they said it in.
 *
 * Rupees, not paise, and that is the whole point of the field's name. Asked
 * for paise the model multiplied a ₹1,25,000 budget by ten and the assembler
 * built to ₹12,500 — a mistake nothing downstream can catch, because a tenth
 * of a budget is a perfectly plausible budget. The conversion is arithmetic,
 * so it belongs in code; see the tool's `execute`.
 */
export const captureRequirementsInput = z.object({
  budgetRupees: optional(budgetSchema).describe(
    "What they said they can spend, in rupees. 80000 for ₹80,000 — do not " +
      'convert to paise. A bracket they picked off a list, such as "100001-' +
      '120000", is read as its top end.'
  ),
  constraints: optional(z.record(z.string(), z.unknown())).describe(
    'Hard limits in their own terms, e.g. { "formFactor": "must be small", "noise": "quiet" }.'
  ),
  mustInclude: optional(z.array(z.string().max(80)).max(8)).describe(
    'Parts they asked for by name and want in the build: ["RTX 5090"]. Not ' +
      "the same as ownedParts — this is what they want bought. Pass it the " +
      "moment they name one, so a later build still has it."
  ),
  ownedParts: optional(z.record(z.string(), z.unknown())).describe(
    'Parts they already have and want to keep, e.g. { "monitor": "1440p 165Hz" }.'
  ),
  targetRefreshHz: optional(z.number().int().positive().max(1000)),
  targetResolution: optional(z.string().max(40)).describe(
    'As they said it: "1080p", "1440p", "4K".'
  ),
  useCase: optional(z.string().max(200)).describe(
    "Gaming, editing, development, office work, mixed."
  ),
  workloads: optional(z.array(z.string().max(120)).max(12)).describe(
    "Named games or software. Specifics beat categories."
  ),
});
