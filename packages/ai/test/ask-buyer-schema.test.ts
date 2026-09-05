import { describe, expect, test } from "bun:test";
import {
  askBuyerInput,
  captureRequirementsInput,
} from "../src/tools/ask-buyer-schema";

/**
 * What the interview tools accept, tested against the schemas they use.
 *
 * Every case below is a payload `openai/gpt-oss-20b` actually sent through
 * NVIDIA NIM, copied out of a failed turn. They are not hypotheticals about
 * what a model might do — each one killed a live conversation, and the buyer
 * was shown "the assistant hit an error" in place of the question they had
 * just been asked.
 *
 * The rule these encode: `askBuyer` draws a row of pills. It moves no money
 * and touches no catalogue, so there is nothing for strictness to protect,
 * and every shape it refuses is a turn lost for no benefit. The money tools
 * are strict for a reason and are tested elsewhere.
 */

function askBuyer(input: unknown) {
  return askBuyerInput.parse(input);
}

function capture(input: unknown) {
  return captureRequirementsInput.parse(input);
}

const QUESTION = {
  field: "useCase",
  kind: "choice",
  label: "Use case",
  prompt: "What will you mainly use this PC for?",
};

describe("askBuyer choices", () => {
  test("accepts the documented object form", () => {
    const parsed = askBuyer({
      ...QUESTION,
      choices: [{ label: "Gaming", value: "gaming" }],
    });

    expect(parsed.choices).toEqual([{ label: "Gaming", value: "gaming" }]);
  });

  test("accepts a label with no value, using the label as the answer", () => {
    const parsed = askBuyer({ ...QUESTION, choices: [{ label: "Gaming" }] });

    expect(parsed.choices).toEqual([{ label: "Gaming", value: "Gaming" }]);
  });

  test("accepts bare strings, which is what it sends most often", () => {
    const parsed = askBuyer({
      ...QUESTION,
      choices: ["Gaming", "Video Editing"],
    });

    expect(parsed.choices).toEqual([
      { label: "Gaming", value: "Gaming" },
      { label: "Video Editing", value: "Video Editing" },
    ]);
  });

  test("keeps the first six rather than refusing a seventh", () => {
    // Observed with seven use cases. Six is a judgement about when a row of
    // pills stops being a glance — a reason to show fewer, not none.
    const parsed = askBuyer({
      ...QUESTION,
      choices: ["a", "b", "c", "d", "e", "f", "g"],
    });

    expect(parsed.choices).toHaveLength(6);
    expect(parsed.choices?.at(-1)).toEqual({ label: "f", value: "f" });
  });

  test("accepts null for the field it is not using", () => {
    // A range question sends `"choices": null` rather than omitting it.
    const parsed = askBuyer({
      choices: null,
      field: "budget",
      kind: "range",
      label: "Budget",
      prompt: "What is your budget?",
      range: { max: 200_000, min: 20_000, step: 1000, unit: "₹" },
    });

    expect(parsed.choices).toBeUndefined();
    expect(parsed.range?.max).toBe(200_000);
  });

  test("still refuses a question with no prompt", () => {
    // Leniency about the options, not about whether there is a question.
    expect(() => askBuyer({ ...QUESTION, prompt: undefined })).toThrow();
  });
});

describe("askBuyer range", () => {
  const question = {
    field: "budget",
    kind: "range",
    label: "Budget",
    prompt: "What is your budget for this PC build?",
  };

  test("fills in a step the model did not send", () => {
    // Observed exactly like this: the two ends and nothing else. That is a
    // complete question; the step is a detail of the widget.
    const parsed = askBuyer({ ...question, range: { max: 200_000, min: 0 } });

    expect(parsed.range?.step).toBe(2000);
  });

  test("keeps a step the model did send", () => {
    const parsed = askBuyer({
      ...question,
      range: { max: 200_000, min: 20_000, step: 1000, unit: "₹" },
    });

    expect(parsed.range?.step).toBe(1000);
    expect(parsed.range?.unit).toBe("₹");
  });

  test("accepts the two ends as a bare pair", () => {
    // Observed as `"range": [80000, 200000]`. A pair of numbers on a range is
    // unambiguous, and the buyer loses the question either way.
    const parsed = askBuyer({ ...question, range: [80_000, 200_000] });

    expect(parsed.range?.min).toBe(80_000);
    expect(parsed.range?.max).toBe(200_000);
    expect(parsed.range?.step).toBe(1200);
  });

  test("orders a pair given the wrong way round", () => {
    const parsed = askBuyer({ ...question, range: [200_000, 80_000] });

    expect(parsed.range?.min).toBe(80_000);
    expect(parsed.range?.max).toBe(200_000);
  });

  test("never derives a step of zero from a narrow range", () => {
    // A step of zero is a slider that cannot move — worse than a coarse one.
    const parsed = askBuyer({ ...question, range: { max: 10, min: 5 } });

    expect(parsed.range?.step).toBe(1);
  });
});

describe("captureRequirements budget", () => {
  test("takes a plain number of rupees", () => {
    expect(capture({ budgetRupees: 80_000 }).budgetRupees).toBe(80_000);
  });

  test("reads a bracket the buyer tapped as its top end", () => {
    // The buyer picked "₹1,00,001 – ₹1,20,000" and the model forwarded the
    // label. The question was what they will spend at most, so 120000 is the
    // number they were answering with.
    expect(capture({ budgetRupees: "100001-120000" }).budgetRupees).toBe(
      120_000
    );
  });

  test("reads an amount written with separators and a symbol", () => {
    expect(capture({ budgetRupees: "₹1,25,000" }).budgetRupees).toBe(125_000);
  });

  test("reads the shorthand the model writes its own labels in", () => {
    // Left to itself it offers "15k", "80k", "1L+" — so these are the strings
    // it forwards, and a bare digit read out of "1L+" would be one rupee.
    expect(capture({ budgetRupees: "80k" }).budgetRupees).toBe(80_000);
    expect(capture({ budgetRupees: "1L+" }).budgetRupees).toBe(100_000);
    expect(capture({ budgetRupees: "1.5 lakh" }).budgetRupees).toBe(150_000);
  });

  test("takes the top of a bracket written in shorthand", () => {
    expect(capture({ budgetRupees: "40k-60k" }).budgetRupees).toBe(60_000);
  });

  test("refuses an amount too small to be a machine", () => {
    // The one failure with no symptom: a budget a hundred times too small
    // still builds something, and nothing downstream can tell.
    expect(() => capture({ budgetRupees: "₹12" })).toThrow();
  });

  test("refuses an amount that can only be paise", () => {
    // A ₹4,00,000 budget forwarded as 40000000, which `rupeesToPaise` turned
    // into ₹4 crore and Postgres refused as out of range for the column. The
    // buyer saw the turn die; the model should be told to resend in rupees.
    expect(() => capture({ budgetRupees: 40_000_000 })).toThrow();
    expect(() => capture({ budgetRupees: "40000000" })).toThrow();
  });

  test("still takes the most expensive machine anyone would ask for", () => {
    expect(capture({ budgetRupees: "5L" }).budgetRupees).toBe(500_000);
  });

  test("accepts null for a budget not given yet", () => {
    expect(capture({ budgetRupees: null }).budgetRupees).toBeUndefined();
  });

  test("refuses a string with no amount in it", () => {
    // Guessing at "as cheap as possible" would put a number in the buyer's
    // mouth, and the whole build is sized off this one field.
    expect(() => capture({ budgetRupees: "not sure yet" })).toThrow();
  });
});
