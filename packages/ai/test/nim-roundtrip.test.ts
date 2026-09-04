import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { generateText, streamText } from "ai";

/**
 * The fold and the extraction, as one round trip.
 *
 * `foldDelta` is unit-tested next door, but the thing that actually has to
 * hold is the pair: NIM's shape goes in, the SDK's reasoning parts come out,
 * and — the part that matters — the model's thinking does **not** end up in
 * the visible answer.
 *
 * That last one is not cosmetic. Assistant text is persisted and sent back as
 * history on the next turn, and NIM rejects analysis prose in an assistant
 * message with a 400 ("unexpected tokens remaining in message header"). So a
 * leak here does not spoil one reply, it ends the conversation — every
 * subsequent turn fails and the buyer is told the assistant hit an error with
 * no way past it. Both directions are pinned because both were observed.
 */

const REASONING = "We need to call findSlowMovers correctly. Use the tool.";
const ANSWER = "Three products are moving slowly.";

let originalFetch: typeof globalThis.fetch;

function jsonResponse(message: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", index: 0, message }],
      created: 0,
      id: "chatcmpl-test",
      model: "openai/gpt-oss-20b",
      object: "chat.completion",
    }),
    { headers: { "content-type": "application/json" }, status: 200 }
  );
}

function sseResponse(chunks: Record<string, unknown>[]) {
  const body = [
    ...chunks.map(
      (delta) =>
        `data: ${JSON.stringify({
          choices: [{ delta, finish_reason: null, index: 0 }],
          id: "chatcmpl-test",
          model: "openai/gpt-oss-20b",
          object: "chat.completion.chunk",
        })}\n\n`
    ),
    `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: "stop", index: 0 }],
      id: "chatcmpl-test",
      model: "openai/gpt-oss-20b",
      object: "chat.completion.chunk",
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  });
}

/** Loaded after the env is set, so the provider picks NVIDIA. */
async function nimModel() {
  const { chatModel } = await import("../src/provider");

  return chatModel();
}

beforeEach(() => {
  process.env.AI_PROVIDER = "nvidia";
  process.env.NVIDIA_API_KEY = "test-key";
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("NIM reasoning round trip", () => {
  test("generate: reasoning is lifted out and the answer stays clean", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({
          content: ANSWER,
          reasoning_content: REASONING,
          role: "assistant",
        })
      )) as unknown as typeof fetch;

    const result = await generateText({
      model: await nimModel(),
      prompt: "what is not selling?",
    });

    expect(result.reasoningText).toBe(REASONING);
    /* The whole point: the thinking is not in what gets persisted. */
    expect(result.text).toBe(ANSWER);
    expect(result.text).not.toContain("findSlowMovers");
    expect(result.text).not.toContain("nim_reasoning");
  });

  test("generate: a turn that only reasoned leaves no text behind", async () => {
    /*
     * The tool-call step, which is most steps. An unclosed block would make
     * the entire reply reasoning; a missing one would make it all answer.
     */
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({
          content: null,
          reasoning_content: REASONING,
          role: "assistant",
        })
      )) as unknown as typeof fetch;

    const result = await generateText({
      model: await nimModel(),
      prompt: "what is not selling?",
    });

    expect(result.reasoningText).toBe(REASONING);
    expect(result.text).toBe("");
  });

  test("stream: reasoning and answer arrive as separate parts", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        sseResponse([
          { role: "assistant" },
          { reasoning_content: "We need to " },
          { reasoning_content: "check the data." },
          { content: "Three products" },
          { content: " are slow." },
        ])
      )) as unknown as typeof fetch;

    const result = streamText({
      model: await nimModel(),
      prompt: "what is not selling?",
    });

    let reasoning = "";
    let text = "";

    for await (const part of result.stream) {
      if (part.type === "reasoning-delta") {
        reasoning += part.text;
      }

      if (part.type === "text-delta") {
        text += part.text;
      }
    }

    expect(reasoning).toBe("We need to check the data.");
    expect(text).toBe("Three products are slow.");
    expect(text).not.toContain("nim_reasoning");
  });

  test("generate: harmony tokens never reach the answer", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({
          content: `${ANSWER}<|end|><|start|>assistant<|channel|>final`,
          reasoning_content: REASONING,
          role: "assistant",
        })
      )) as unknown as typeof fetch;

    const result = await generateText({
      model: await nimModel(),
      prompt: "what is not selling?",
    });

    /* These are what NIM rejects when the text comes back as history. */
    expect(result.text).not.toContain("<|");
    expect(result.text).toContain(ANSWER);
  });
});
