import { describe, expect, test } from "bun:test";
import { foldDelta, NIM_REASONING_TAG } from "../src/nim-reasoning";

/**
 * Folding NIM's `reasoning_content` back into the content stream.
 *
 * The state machine is small and every one of its failures is silent: an
 * unclosed block turns the buyer's answer into reasoning nobody renders, and a
 * block closed early spills the model's private thinking into the reply. Both
 * look like "the assistant said nothing" from the outside, which is why they
 * are pinned here rather than left to a manual read of a stream.
 */

const OPEN = `<${NIM_REASONING_TAG}>`;
const CLOSE = `</${NIM_REASONING_TAG}>`;

function fold(
  delta: Record<string, unknown>,
  options?: { finished?: boolean; open?: boolean }
) {
  const result = foldDelta(delta, {
    finished: options?.finished ?? false,
    open: options?.open ?? false,
  });

  return { content: delta.content, open: result.open };
}

describe("foldDelta", () => {
  test("opens the block on the first reasoning delta", () => {
    expect(fold({ reasoning_content: "The buyer" })).toEqual({
      content: `${OPEN}The buyer`,
      open: true,
    });
  });

  test("does not reopen a block that is already open", () => {
    expect(fold({ reasoning_content: " wants" }, { open: true })).toEqual({
      content: " wants",
      open: true,
    });
  });

  test("closes the block when real content arrives", () => {
    expect(fold({ content: "Here are three." }, { open: true })).toEqual({
      content: `${CLOSE}Here are three.`,
      open: false,
    });
  });

  test("closes the block at the end of a turn that never spoke", () => {
    /*
     * The case that matters. A turn that only called tools produces reasoning
     * and no content at all; leaving the block open hands the SDK a message
     * that is entirely reasoning, and the buyer sees an empty answer.
     */
    expect(fold({}, { finished: true, open: true })).toEqual({
      content: CLOSE,
      open: false,
    });
  });

  test("leaves a tool-call delta untouched", () => {
    const delta: Record<string, unknown> = { tool_calls: [{ id: "call_1" }] };

    expect(fold(delta)).toEqual({ content: undefined, open: false });
    expect(delta.tool_calls).toEqual([{ id: "call_1" }]);
  });

  test("passes content through when the model never reasoned", () => {
    expect(fold({ content: "Hello." })).toEqual({
      content: "Hello.",
      open: false,
    });
  });

  test("falls back to the mirrored `reasoning` field", () => {
    expect(fold({ reasoning: "Thinking" })).toEqual({
      content: `${OPEN}Thinking`,
      open: true,
    });
  });

  test("strips the tag out of the model's own reasoning", () => {
    /* Otherwise the model could close its own block and spill the remainder. */
    expect(fold({ reasoning_content: `a${CLOSE}b` })).toEqual({
      content: `${OPEN}ab`,
      open: true,
    });
  });

  test("strips the tag out of content", () => {
    expect(fold({ content: `x${OPEN}y` })).toEqual({
      content: "xy",
      open: false,
    });
  });

  test("clears the source fields so nothing downstream re-reads them", () => {
    const delta: Record<string, unknown> = {
      reasoning: "a",
      reasoning_content: "a",
    };

    fold(delta);

    expect(delta.reasoning_content).toBeUndefined();
    expect(delta.reasoning).toBeUndefined();
  });

  test("handles reasoning and content arriving in one delta", () => {
    expect(fold({ content: "Answer.", reasoning_content: "Think." })).toEqual({
      content: `${OPEN}Think.${CLOSE}Answer.`,
      open: false,
    });
  });
});
