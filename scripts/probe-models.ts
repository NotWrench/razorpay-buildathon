/**
 * Which NIM models can actually run this agent.
 *
 * Not a benchmark. Three things decide whether a free model is usable here and
 * none of them are scores: does it call a tool at all, does it survive its own
 * tool call coming back as history, and does it answer before the buyer leaves.
 *
 *   bun run models:probe
 *
 * The measurements in `packages/ai/src/provider.ts` came from here. NIM's
 * lineup moves, so re-run it before changing `NVIDIA_CHAT_MODEL` rather than
 * trusting either that comment or a benchmark table.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

const CANDIDATES = [
  "openai/gpt-oss-20b",
  "nvidia/nemotron-nano-3-30b-a3b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nvidia/nemotron-3-super-120b-a12b",
  "mistralai/mistral-nemotron",
  "deepseek-ai/deepseek-v4-flash-0731",
  "moonshotai/kimi-k2.6",
  "minimaxai/minimax-m3",
  "nvidia/llama-3.1-nemotron-70b-instruct",
];

const apiKey = process.env.NVIDIA_API_KEY;

if (!apiKey) {
  throw new Error("NVIDIA_API_KEY is required");
}

const nim = createOpenAI({
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
  name: "nvidia",
});

/** The real shape, near enough: one client tool and one server tool. */
const tools = {
  askBuyer: tool({
    description:
      "Ask the buyer ONE question and offer the answers as tappable options.",
    inputSchema: z.object({
      choices: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .nullish(),
      field: z.string(),
      kind: z.enum(["choice", "multi", "range"]),
      label: z.string(),
      prompt: z.string(),
    }),
    outputSchema: z.string(),
  }),
  searchProducts: tool({
    description: "Search the store catalog for parts.",
    execute: ({ query }: { query: string }) => ({
      products: [{ name: `A part matching ${query}`, pricePaise: 999_900 }],
    }),
    inputSchema: z.object({ query: z.string() }),
  }),
};

const SYSTEM =
  "You are a shopping assistant for a PC parts store. Ask the buyer what " +
  "they need using askBuyer before recommending anything. Use searchProducts " +
  "to find parts. Never invent a price.";

interface Result {
  calledTool: string | null;
  error: string | null;
  model: string;
  ms: number;
  survivedHistory: boolean | null;
}

async function probe(model: string): Promise<Result> {
  const started = Date.now();
  const out: Result = {
    calledTool: null,
    error: null,
    model,
    ms: 0,
    survivedHistory: null,
  };

  try {
    const first = await generateText({
      messages: [{ content: "Build me a gaming PC", role: "user" }],
      model: nim.chat(model),
      stopWhen: stepCountIs(3),
      system: SYSTEM,
      tools,
    });

    out.ms = Date.now() - started;
    out.calledTool =
      first.steps.flatMap((s) => s.toolCalls).at(0)?.toolName ?? null;

    /*
     * The turn that actually breaks today. The first call's own tool call goes
     * back as history, and NIM re-renders it into the model's prompt format —
     * which is where a leaked control token in the tool name becomes a 400 and
     * kills every later turn of the conversation.
     */
    const call = first.steps.flatMap((s) => s.toolCalls).at(0);

    if (!call) {
      out.survivedHistory = null;

      return out;
    }

    await generateText({
      messages: [
        { content: "Build me a gaming PC", role: "user" },
        {
          content: [
            {
              input: call.input,
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              type: "tool-call",
            },
          ],
          role: "assistant",
        },
        {
          content: [
            {
              output: { type: "text", value: "Gaming" },
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              type: "tool-result",
            },
          ],
          role: "tool",
        },
      ],
      model: nim.chat(model),
      stopWhen: stepCountIs(2),
      system: SYSTEM,
      tools,
    });

    out.survivedHistory = true;
  } catch (error) {
    out.ms = out.ms || Date.now() - started;
    out.error = (error as Error).message.slice(0, 150).replaceAll("\n", " ");

    if (out.calledTool) {
      out.survivedHistory = false;
    }
  }

  return out;
}

const results: Result[] = [];

for (const model of CANDIDATES) {
  process.stdout.write(`probing ${model} … `);

  /*
   * One at a time on purpose. The number being measured is how long a model
   * takes on a free tier NIM serves by queueing, and probing in parallel would
   * put every candidate in that queue at once — so the timings would measure
   * the contention this loop created rather than the models.
   */
  // biome-ignore lint/performance/noAwaitInLoops: sequential, or the timings measure each other
  const result = await probe(model);

  results.push(result);
  console.log(
    `${result.ms}ms tool=${result.calledTool ?? "none"} history=${result.survivedHistory ?? "n/a"}${result.error ? ` ERROR ${result.error}` : ""}`
  );
}

console.log("\n--- summary ---");
for (const r of results) {
  const ok = r.calledTool && r.survivedHistory && !r.error;
  console.log(
    `${ok ? "OK  " : "BAD "} ${r.model.padEnd(42)} ${String(r.ms).padStart(6)}ms  ${r.error ?? ""}`
  );
}

process.exit(0);
