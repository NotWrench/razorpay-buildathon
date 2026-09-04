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
 * Removes the tag from text that is about to be wrapped in it.
 *
 * The model's thinking is untrusted text as far as this transform is
 * concerned: a `</nim_reasoning>` inside it would close the block early and
 * the rest of the reasoning would be rendered as the answer.
 */
function sanitise(text: string): string {
  return text.includes(NIM_REASONING_TAG)
    ? text.replace(TAG_PATTERN, "")
    : text;
}

interface Delta {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
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
 * Rewrites one delta in place, and reports whether the block is still open.
 *
 * Separate from the stream plumbing so the state machine — which is where the
 * bugs live — can be tested directly.
 */
export function foldDelta(
  delta: Delta,
  options: { finished: boolean; open: boolean }
): { open: boolean } {
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
