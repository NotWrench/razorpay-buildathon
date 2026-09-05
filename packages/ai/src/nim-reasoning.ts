import { cleanToolName } from "./agents/repair";

/**
 * Recovering the reasoning NVIDIA NIM already sends.
 *
 * `openai/gpt-oss-*` speaks Harmony, which separates the model's own thinking
 * (the `analysis` channel) from what it says to the buyer (`final`). NIM's
 * OpenAI-compatible adapter parses that apart and returns the thinking in its
 * own field — `reasoning_content`, mirrored as `reasoning` — rather than mixed
 * into `content`.
 *
 * `@ai-sdk/openai` parses neither field. It reads `content` and `tool_calls`
 * and drops the rest, so every turn this project has ever run has discarded
 * the model's reasoning at the provider boundary. Measured on one ordinary
 * shopping question: 214 reasoning deltas against 27 content deltas. The model
 * was thinking the whole time and nobody could see it.
 *
 * Rather than write a language model that speaks NIM's dialect, this folds the
 * reasoning back into `content` inside an XML tag on the way past, and the
 * SDK's own `extractReasoningMiddleware` lifts it back out into real reasoning
 * parts. The provider stays stock, the middleware is first-party, and the only
 * bespoke code is this rewrite.
 *
 * The tag is deliberately not `think`. A tag the model might plausibly type
 * into an answer is an injection vector: content that happened to contain
 * `</think>` would end the block early and spill the rest of its private
 * reasoning into the buyer's view. `nim_reasoning` is not a string gpt-oss
 * writes, and `sanitise` closes the remaining gap.
 */

export const NIM_REASONING_TAG = "nim_reasoning";

const OPEN = `<${NIM_REASONING_TAG}>`;
const CLOSE = `</${NIM_REASONING_TAG}>`;

/** Both spellings of the tag, wherever they appear. */
const TAG_PATTERN = new RegExp(`</?${NIM_REASONING_TAG}>`, "g");

/**
 * Harmony's own control tokens: `<|end|>`, `<|start|>`, `<|channel|>`.
 *
 * NIM parses these out of the model's output for us and intermittently misses
 * some — the same leak `agents/repair.ts` fixes for tool names, which arrive
 * as `searchProducts<|channel|>commentary` about one call in four.
 *
 * In assistant text the consequence is worse than a cosmetic one, and it is
 * not this turn that pays. The text is persisted and sent back as history on
 * the next turn, and NIM rejects its own tokens on the way in — 400,
 * "unexpected tokens remaining in message header". So one leaked token turns
 * every subsequent turn of that conversation into a failure, and the buyer is
 * told the assistant hit an error with no way to get past it but starting
 * over. Stripping them costs a few stray words in one reply.
 */
const HARMONY_TOKEN = /<\|[^|>]*\|>/g;

/**
 * Removes anything that would be read as markup rather than as words.
 *
 * The model's own output is untrusted text as far as this transform is
 * concerned. A `</nim_reasoning>` inside its thinking would close the block
 * early and spill the rest into the buyer's view; a harmony token inside its
 * answer poisons the next turn.
 */
function sanitise(text: string): string {
  return text.replace(TAG_PATTERN, "").replace(HARMONY_TOKEN, "");
}

/** One tool call, as it streams: the name whole, the arguments in pieces. */
interface ToolCallDelta {
  function?: { arguments?: string; name?: string };
}

interface Delta {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  tool_calls?: ToolCallDelta[] | null;
}

interface Choice {
  delta?: Delta;
  finish_reason?: string | null;
  index?: number;
  message?: Delta;
}

interface Envelope {
  choices?: Choice[];
}

/**
 * Strips the control tokens from a tool call's name as it goes past.
 *
 * The same leak as the text above, and the more expensive one. A name arrives
 * as `searchProducts<|channel|>commentary`, and `agents/repair.ts` recovers it
 * so the right tool runs — but only for that dispatch. The mangled name is
 * what gets recorded on the message, so it goes back to NIM as history on the
 * next turn, NIM renders it into its own prompt header, and its own parser
 * then rejects it: 400, "unexpected tokens remaining in message header". One
 * leak therefore kills every later turn of the conversation.
 *
 * Fixing it here rather than downstream is what makes that impossible instead
 * of merely recoverable: the SDK never sees the mangled name, so nothing
 * persists it, nothing renders it, and nothing sends it back. The repair in
 * `agents/repair.ts` stays as the backstop for anything this misses.
 *
 * Truncating at the first `<|` is safe even though the name may in principle
 * arrive in pieces. A fragment with no control token is left exactly as it is,
 * and a fragment that is nothing but the token truncates to the empty string —
 * so a split name still concatenates back to the right one either way.
 */
function cleanToolNames(delta: Delta): void {
  for (const call of delta.tool_calls ?? []) {
    const name = call.function?.name;

    if (call.function && name?.includes("<|")) {
      call.function.name = cleanToolName(name);
    }
  }
}

/**
 * Rewrites one delta in place, and reports whether the block is still open.
 *
 * Separate from the stream plumbing so the state machine — which is where the
 * bugs live — can be tested directly.
 */
export function foldDelta(
  delta: Delta,
  options: { finished: boolean; open: boolean }
): { open: boolean } {
  cleanToolNames(delta);

  const reasoning = delta.reasoning_content ?? delta.reasoning ?? "";
  const content = delta.content ?? "";

  let { open } = options;
  let out = "";

  if (reasoning) {
    if (!open) {
      out += OPEN;
      open = true;
    }

    out += sanitise(reasoning);
  }

  /*
   * Real content closes the block, and so does the end of the turn. The second
   * case is the one that matters: a turn that only called tools produces
   * reasoning and never a word of content, and an unclosed block would leave
   * the SDK treating the whole answer as reasoning.
   */
  if (open && (content || options.finished)) {
    out += CLOSE;
    open = false;
  }

  out += sanitise(content);

  /* Left untouched when there was nothing to fold — a tool-call delta, say. */
  if (out !== "") {
    delta.content = out;
  }

  delta.reasoning_content = undefined;
  delta.reasoning = undefined;

  return { open };
}

/** Splits an SSE body into whole lines, holding a partial line back. */
function lineSplitter(): TransformStream<string, string> {
  let buffer = "";

  return new TransformStream<string, string>({
    flush(controller) {
      if (buffer) {
        controller.enqueue(buffer);
      }
    },
    transform(chunk, controller) {
      buffer += chunk;

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        controller.enqueue(`${line}\n`);
      }
    },
  });
}

/**
 * The per-choice open/closed state, and the rewrite applied to each line.
 *
 * State is keyed by choice index rather than held as one flag: `n > 1` is not
 * used here today, and one flag would interleave two choices' blocks into
 * nonsense the day it is.
 */
function reasoningFolder(): TransformStream<string, string> {
  const open = new Map<number, boolean>();

  return new TransformStream<string, string>({
    transform(line, controller) {
      const payload = line.startsWith("data: ") ? line.slice(6).trim() : null;

      /* Comments, blank lines and the terminator go straight through. */
      if (!payload || payload === "[DONE]") {
        controller.enqueue(line);

        return;
      }

      let envelope: Envelope;

      try {
        envelope = JSON.parse(payload) as Envelope;
      } catch {
        /* Not ours to repair. Forward it and let the SDK report it. */
        controller.enqueue(line);

        return;
      }

      for (const [position, choice] of (envelope.choices ?? []).entries()) {
        const index = choice.index ?? position;

        if (!choice.delta) {
          continue;
        }

        const next = foldDelta(choice.delta, {
          finished: Boolean(choice.finish_reason),
          open: open.get(index) ?? false,
        });

        open.set(index, next.open);
      }

      controller.enqueue(`data: ${JSON.stringify(envelope)}\n`);
    },
  });
}

/**
 * Folds a non-streamed response's reasoning into its message content.
 *
 * `generateText` against this provider comes through here — the classification
 * and summarisation side-quests in `fastModel()` among them — and would
 * otherwise be the one path where the tag never appears and the middleware has
 * nothing to extract.
 */
async function foldJsonBody(response: Response): Promise<Response> {
  const body = (await response.json()) as Envelope;

  for (const choice of body.choices ?? []) {
    if (choice.message) {
      foldDelta(choice.message, { finished: true, open: false });
    }
  }

  return new Response(JSON.stringify(body), {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * A `fetch` for the NIM client that leaves `reasoning_content` where the SDK
 * can find it.
 *
 * Anything that is not a successful chat completion — an error body, a 429, an
 * embedding call — is returned untouched. This is a rewrite, not a proxy, and
 * it should be invisible to every path it does not serve.
 */
export function reasoningFetch(): typeof globalThis.fetch {
  const wrapped = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await fetch(input, init);

    if (!(response.ok && response.body)) {
      return response;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return await foldJsonBody(response);
    }

    if (!contentType.includes("text/event-stream")) {
      return response;
    }

    return new Response(
      response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(lineSplitter())
        .pipeThrough(reasoningFolder())
        .pipeThrough(new TextEncoderStream()),
      {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      }
    );
  };

  /*
   * Bun's global `fetch` carries a Bun-only `preconnect`, and the SDK's
   * `FetchFunction` is an alias of `typeof globalThis.fetch` — so under Bun's
   * types a plain wrapper is not assignable, while under Node's it is. A
   * middleware that forwards every call to the real `fetch` has no business
   * reimplementing a connection hint, so the shape is asserted rather than
   * faked. The assertion is a no-op wherever `preconnect` does not exist.
   */
  return wrapped as typeof globalThis.fetch;
}
