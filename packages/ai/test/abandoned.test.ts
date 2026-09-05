import { describe, expect, test } from "bun:test";
import { convertToModelMessages, type UIMessage } from "ai";
import { settleAbandonedToolCalls } from "../src/agents/abandoned";

/**
 * The thread that died when the buyer typed instead of tapping.
 *
 * `askBuyer` asks for a budget with options to tap; the buyer typed their own
 * number instead, which is behaviour the composer deliberately allows. The
 * question was left with a tool call and no result, and from that point every
 * turn — including every retry — failed while the prompt was being built,
 * before the model was ever called.
 */

/** A thread that stopped on an unanswered question, then a typed reply. */
function abandonedThread(): UIMessage[] {
  return [
    {
      id: "m1",
      parts: [{ text: "Build me a gaming PC", type: "text" }],
      role: "user",
    },
    {
      id: "m2",
      parts: [
        { type: "step-start" },
        {
          input: { prompt: "What's your budget?" },
          state: "input-available",
          toolCallId: "call-1",
          type: "tool-askBuyer",
        },
      ],
      role: "assistant",
    },
    {
      id: "m3",
      parts: [{ text: "around 90000", type: "text" }],
      role: "user",
    },
  ] as unknown as UIMessage[];
}

/**
 * Tool calls in the prompt with no result behind them.
 *
 * This is the condition the SDK checks while building the prompt — one left
 * over and it throws `AI_MissingToolResultsError`, and the turn is dead before
 * the model is called. Counted here rather than asserting on the error itself,
 * because the throw happens inside `streamText`, past the point a test can
 * reach without a provider.
 */
async function unresolvedToolCalls(messages: UIMessage[]): Promise<string[]> {
  const outstanding = new Set<string>();

  for (const message of await convertToModelMessages(messages)) {
    if (typeof message.content === "string") {
      continue;
    }

    for (const part of message.content) {
      if (part.type === "tool-call" && !part.providerExecuted) {
        outstanding.add(part.toolCallId);
      }

      if (part.type === "tool-result") {
        outstanding.delete(part.toolCallId);
      }
    }
  }

  return Array.from(outstanding);
}

describe("settleAbandonedToolCalls", () => {
  test("the unfixed thread is the one the SDK refuses", async () => {
    // Pinned so the fix below is measured against the real failure rather
    // than a description of it.
    expect(await unresolvedToolCalls(abandonedThread())).toEqual(["call-1"]);
  });

  test("a settled thread leaves nothing outstanding, so the turn runs", async () => {
    expect(
      await unresolvedToolCalls(settleAbandonedToolCalls(abandonedThread()))
    ).toEqual([]);
  });

  test("an unanswered question is closed as answered in the composer", () => {
    const [, assistant] = settleAbandonedToolCalls(abandonedThread());
    const part = assistant?.parts[1] as { output: string; state: string };

    expect(part.state).toBe("output-available");
    // The model has to be told where the answer came from, or it re-asks the
    // question it was just answered.
    expect(part.output).toContain("replied in their own words");
  });

  test("a server tool cut off mid-flight is closed as an error", () => {
    const [message] = settleAbandonedToolCalls([
      {
        parts: [
          {
            state: "input-available",
            toolCallId: "call-2",
            type: "tool-searchProducts",
          },
        ],
      },
    ]);
    const part = message?.parts[0] as unknown as {
      errorText: string;
      state: string;
    };

    // Never an output: a fabricated search result is one the model would
    // reason over as if the search had happened.
    expect(part.state).toBe("output-error");
    expect(part.errorText).toContain("never ran");
  });

  test("an approval nobody answered drops its request with it", () => {
    const [message] = settleAbandonedToolCalls([
      {
        parts: [
          {
            approval: { id: "approval-1" },
            state: "approval-requested",
            toolCallId: "call-3",
            type: "tool-createOrder",
          },
        ],
      },
    ]);
    const part = message?.parts[0] as { approval?: unknown; state: string };

    expect(part.state).toBe("output-error");
    expect(part.approval).toBeUndefined();
  });

  test("a question mangled by the model's control tokens still settles", () => {
    const [message] = settleAbandonedToolCalls([
      {
        parts: [
          {
            state: "input-available",
            type: "tool-askBuyer<|channel|>commentary",
          },
        ],
      },
    ]);
    const part = message?.parts[0] as { output?: string; state: string };

    expect(part.state).toBe("output-available");
    expect(part.output).toContain("replied in their own words");
  });

  test("settled tool calls are left exactly as they are", () => {
    // Identity, so a healthy thread is not rebuilt on every turn.
    const messages = [
      {
        parts: [
          {
            output: "Gaming",
            state: "output-available",
            type: "tool-askBuyer",
          },
          { state: "approval-responded", type: "tool-createOrder" },
          { state: "input-streaming", type: "tool-searchProducts" },
        ],
      },
    ];

    expect(settleAbandonedToolCalls(messages)[0]).toBe(messages[0]);
  });
});
