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

  test("strips harmony control tokens out of content", () => {
    /*
     * The leak that poisons the *next* turn: this text is persisted and sent
     * back as history, and NIM rejects its own tokens on the way in with a
     * 400. One leaked token would otherwise end the conversation.
     */
    expect(
      fold({ content: "Here it is.<|end|><|start|>assistant<|channel|>final" })
    ).toEqual({
      content: "Here it is.assistantfinal",
      open: false,
    });
  });

  test("strips harmony control tokens out of reasoning too", () => {
    expect(fold({ reasoning_content: "Let me check<|end|>" })).toEqual({
      content: `${OPEN}Let me check`,
      open: true,
    });
  });

  test("leaves ordinary angle brackets alone", () => {
    /* A price comparison is not markup. */
    expect(fold({ content: "8GB < 16GB, and 3 > 2." })).toEqual({
      content: "8GB < 16GB, and 3 > 2.",
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

/**
 * Cleaning the tool name at the boundary, before anything can record it.
 *
 * This is the expensive half of the leak. `agents/repair.ts` recovers the name
 * for dispatch, so the right tool runs and the turn looks fine — but the
 * mangled name is what gets written onto the message, and the message comes
 * back as history on the next turn. NIM renders it into its own prompt header
 * and its own parser then refuses it with a 400. So the turn that leaks is
 * never the turn that fails: every *later* turn does, for good, and the buyer
 * has no way past it but abandoning the conversation.
 *
 * Cleaning it here is what makes that unreachable rather than survivable —
 * the SDK never sees the mangled name, so nothing persists it and nothing
 * sends it back.
 */
describe("foldDelta tool names", () => {
  test("strips the control tokens NIM leaves on a tool name", () => {
    const delta = {
      tool_calls: [
        { function: { arguments: "", name: "askBuyer<|channel|>commentary" } },
      ],
    };

    fold(delta);

    expect(delta.tool_calls.map((call) => call.function.name)).toEqual([
      "askBuyer",
    ]);
  });

  test("leaves a well-formed name alone", () => {
    const delta = {
      tool_calls: [{ function: { arguments: "", name: "searchProducts" } }],
    };

    fold(delta);

    expect(delta.tool_calls.map((call) => call.function.name)).toEqual([
      "searchProducts",
    ]);
  });

  test("survives a name split across deltas", () => {
    // Truncating at the first `<|` concatenates back to the right name whether
    // the token arrives attached to the name or in a fragment of its own.
    const head = {
      tool_calls: [{ function: { arguments: "", name: "search" } }],
    };
    const tail = {
      tool_calls: [
        { function: { arguments: "", name: "Products<|channel|>commentary" } },
      ],
    };

    fold(head);
    fold(tail);

    expect(
      [...head.tool_calls, ...tail.tool_calls]
        .map((call) => call.function.name)
        .join("")
    ).toBe("searchProducts");
  });

  test("leaves a delta with no tool calls untouched", () => {
    const delta = { content: "Here are three options." };

    expect(fold(delta).content).toBe("Here are three options.");
  });
});
