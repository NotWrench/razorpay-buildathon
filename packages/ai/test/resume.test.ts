import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { lastAssistantTurnIsAnswered } from "../src/client/resume";

/**
 * When a suspended turn resumes.
 *
 * Both failure directions are invisible from the outside and look identical to
 * the buyer — the thread simply stops. Resuming too early cuts off a question
 * that is still on screen and the model answers on the buyer's behalf; too
 * late and the tap goes nowhere. Neither throws, so nothing but this says
 * which one happened.
 */

type Part = UIMessage["parts"][number];

function assistant(...parts: Part[]): UIMessage {
  return { id: "m1", parts, role: "assistant" };
}

function toolPart(state: string, overrides: Record<string, unknown> = {}) {
  return {
    state,
    toolCallId: "call_1",
    type: "tool-askBuyer",
    ...overrides,
  } as unknown as Part;
}

const STEP_START = { type: "step-start" } as unknown as Part;
const TEXT = { text: "Right.", type: "text" } as unknown as Part;

function check(...messages: UIMessage[]) {
  return lastAssistantTurnIsAnswered({ messages });
}

describe("lastAssistantTurnIsAnswered", () => {
  test("waits while a question is still on screen", () => {
    /* The whole point: the buyer has not tapped anything yet. */
    expect(check(assistant(STEP_START, toolPart("input-available")))).toBe(
      false
    );
  });

  test("waits while a question is still streaming in", () => {
    expect(check(assistant(STEP_START, toolPart("input-streaming")))).toBe(
      false
    );
  });

  test("resumes once the question is answered", () => {
    expect(
      check(
        assistant(STEP_START, toolPart("output-available", { output: "1440p" }))
      )
    ).toBe(true);
  });

  test("resumes once a money action is approved", () => {
    /*
     * `approval-responded`, which the SDK's tool-calls predicate rejects. An
     * approved order that never resumes is a buyer who pressed Approve and
     * watched nothing happen.
     */
    expect(
      check(
        assistant(
          STEP_START,
          toolPart("approval-responded", { type: "tool-createOrder" })
        )
      )
    ).toBe(true);
  });

  test("resumes when the buyer refuses", () => {
    expect(check(assistant(STEP_START, toolPart("output-denied")))).toBe(true);
  });

  test("resumes when a tool failed", () => {
    /* The model is owed the failure; it is the thing it has to explain. */
    expect(check(assistant(STEP_START, toolPart("output-error")))).toBe(true);
  });

  test("waits when one of two tools is still open", () => {
    expect(
      check(
        assistant(
          STEP_START,
          toolPart("output-available", { type: "tool-searchProducts" }),
          toolPart("input-available")
        )
      )
    ).toBe(false);
  });

  test("judges only the current step", () => {
    /*
     * An earlier step's settled tools must not resume a later step that is
     * still waiting — otherwise a turn that searched, asked, then searched
     * again would answer its own question.
     */
    expect(
      check(
        assistant(
          STEP_START,
          toolPart("output-available", { type: "tool-searchProducts" }),
          STEP_START,
          toolPart("input-available")
        )
      )
    ).toBe(false);
  });

  test("does not resume a turn with no tools in it", () => {
    expect(check(assistant(STEP_START, TEXT))).toBe(false);
  });

  test("does not resume on settled server tools alone", () => {
    /*
     * The step-cap loop. A turn that runs out of steps ends with its last step
     * full of ordinary settled server calls; resuming on those sends a turn
     * nobody asked for, which runs out of steps, which resumes again. Only a
     * person's answer earns a resume.
     */
    expect(
      check(
        assistant(
          STEP_START,
          toolPart("output-available", { type: "tool-searchProducts" }),
          toolPart("output-available", { type: "tool-quoteOrder" })
        )
      )
    ).toBe(false);
  });

  test("ignores provider-executed tools", () => {
    /* The provider resolves those itself; they are never ours to wait on. */
    expect(
      check(
        assistant(
          STEP_START,
          toolPart("input-available", { providerExecuted: true })
        )
      )
    ).toBe(false);
  });

  test("does not resume on the buyer's own message", () => {
    expect(check({ id: "u1", parts: [TEXT], role: "user" } as UIMessage)).toBe(
      false
    );
  });

  test("does not resume an empty thread", () => {
    expect(check()).toBe(false);
  });
});
