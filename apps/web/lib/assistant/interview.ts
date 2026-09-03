/**
 * The requirement interview, as data.
 *
 * Kept here rather than inside the components so the question set is a thing
 * you edit, not a thing you refactor. Two rules govern it, and both are about
 * not wasting the buyer's turns:
 *
 * - A question whose answer cannot change the recommendation is not asked.
 *   `askWhen` decides that from what has already been answered.
 * - Anything safely inferable is skipped with a sentence saying what was
 *   assumed, so the assumption is visible and correctable rather than silent.
 */

export type AnswerKind = "choice" | "range" | "multi";

export interface InterviewChoice {
  label: string;
  /** What the collapsed row shows once chosen. */
  value: string;
}

export interface InterviewQuestion {
  /** Only asked when this returns true for the answers so far. */
  askWhen?: (answers: Record<string, string>) => boolean;
  choices?: InterviewChoice[];
  /**
   * How the answer reads on the collapsed row. The stored answer stays raw so
   * `askWhen` and `inferred` can do arithmetic on it — formatting a value the
   * logic then has to parse back is how a budget becomes NaN.
   */
  format?: (value: string) => string;
  id: string;
  /** What the assistant says when it skips this and assumes instead. */
  inferred?: (answers: Record<string, string>) => string | null;
  /** Answers to these become invalid when this one changes. */
  invalidates?: string[];
  kind: AnswerKind;
  /** The label on the collapsed row. */
  label: string;
  prompt: string;
  range?: { max: number; min: number; step: number };
}

const GAMING = /gaming|mixed|streaming/i;

export const INTERVIEW: InterviewQuestion[] = [
  {
    format: (value) => `₹${Number(value).toLocaleString("en-IN")}`,
    id: "budget",
    invalidates: ["resolution", "storage"],
    kind: "range",
    label: "Budget",
    prompt: "What are you looking to spend, all in?",
    range: { max: 400_000, min: 40_000, step: 5000 },
  },
  {
    choices: [
      { label: "Gaming", value: "Gaming" },
      { label: "Streaming", value: "Streaming" },
      { label: "Editing", value: "Editing" },
      { label: "Development", value: "Development" },
      { label: "Mixed", value: "Mixed" },
    ],
    id: "use",
    invalidates: ["resolution"],
    kind: "choice",
    label: "Primary use",
    prompt: "What will it mostly be doing?",
  },
  {
    askWhen: (answers) => GAMING.test(answers.use ?? ""),
    choices: [
      { label: "1080p · 144Hz", value: "1080p · 144Hz" },
      { label: "1440p · 165Hz", value: "1440p · 165Hz" },
      { label: "1440p · 240Hz+", value: "1440p · 240Hz+" },
      { label: "4K · 120Hz", value: "4K · 120Hz" },
    ],
    id: "resolution",
    /* Under a lakh, 4K is not on the table and 1080p is a waste of the card. */
    inferred: (answers) => {
      const budget = Number.parseInt(answers.budget ?? "0", 10);

      return budget > 0 && budget < 90_000
        ? "I'll assume 1440p at 144Hz — say if that's wrong."
        : null;
    },
    kind: "choice",
    label: "Resolution",
    prompt: "What are you driving?",
  },
  {
    choices: [
      { label: "500GB", value: "500GB" },
      { label: "1TB", value: "1TB" },
      { label: "2TB", value: "2TB" },
      { label: "4TB+", value: "4TB+" },
    ],
    id: "storage",
    kind: "choice",
    label: "Storage",
    prompt: "How much storage do you need?",
  },
  {
    choices: [
      { label: "Nothing", value: "Nothing" },
      { label: "Monitor", value: "Monitor" },
      { label: "Case", value: "Case" },
      { label: "Storage", value: "Storage" },
      { label: "Peripherals", value: "Peripherals" },
    ],
    id: "existing",
    kind: "multi",
    label: "Already have",
    prompt: "Anything you already own that I should build around?",
  },
];

/** The next question worth asking, or nothing if the interview is finished. */
export function nextQuestion(
  answers: Record<string, string>,
  skipped: string[]
): InterviewQuestion | undefined {
  return INTERVIEW.find(
    (question) =>
      answers[question.id] === undefined &&
      !skipped.includes(question.id) &&
      (question.askWhen ? question.askWhen(answers) : true)
  );
}

/** Every question that is still relevant — what the progress dots count. */
export function relevantQuestions(answers: Record<string, string>) {
  return INTERVIEW.filter((question) =>
    question.askWhen ? question.askWhen(answers) : true
  );
}
