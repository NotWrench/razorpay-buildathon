import type { UIMessageChunk } from "ai";

/**
 * How long a turn is allowed to take, and what the buyer is told when it does
 * not finish.
 *
 * Both agents stream from a hosted model, and a hosted model can simply stop
 * answering — a queued request on a busy free tier will hold the connection
 * open for as long as you let it. Without a deadline the SDK waits forever, the
 * response stream stays open with nothing in it, and the client renders
 * "Thinking…" until the tab is closed. That is the worst failure available: the
 * agent looks like it is working, so nobody retries, and nothing is logged
 * because nothing errored.
 *
 * A deadline turns that into an ordinary failure — one the buyer can see and
 * act on. It is not a performance tuning knob; it is what makes the difference
 * between a slow turn and a broken one observable at all.
 */

/**
 * Total wall-clock budget for one turn, tools and all.
 *
 * Sized from measurement, not preference: a full storefront turn against the
 * free NVIDIA NIM tier — requirements, search, recommend, quote — completed in
 * 59s once and 101s another time on identical input. The provider's queue, not
 * the work, is the variable, so the budget has to clear the slow case or it
 * cuts off turns that were going to succeed.
 *
 * The deadline is also soft. Aborting stops the in-flight model call, but the
 * agent loop can start one more step before the error propagates: with a 6s
 * budget a turn took 24s to actually end. So the route's `maxDuration` needs a
 * real margin above this, not a token one — otherwise the platform kills the
 * function during the overshoot and we are back to a stream that ends with no
 * explanation, which is the failure this whole module exists to prevent.
 */
const DEFAULT_TURN_BUDGET_MS = 150_000;

export function turnBudgetMs(): number {
  const configured = Number(process.env.AGENT_TURN_BUDGET_MS);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TURN_BUDGET_MS;
}

/**
 * The signal a turn runs under: the client's, and a deadline.
 *
 * The client's signal matters as much as the timeout. A buyer who closes the
 * tab should stop the model mid-sentence rather than leave it generating —
 * and paying — into a socket nobody is reading.
 */
export function turnSignal(clientSignal?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(turnBudgetMs());

  return clientSignal ? AbortSignal.any([clientSignal, deadline]) : deadline;
}

/**
 * Rewrites the stream's abort chunk into an error chunk.
 *
 * This is the difference between a turn that failed and a turn that appears
 * never to have happened. A deadline fired server-side reaches the client as
 * `{ type: "abort" }`, and the client treats that as an ordinary stop: status
 * goes to `ready`, no error is set, and `onFinish` reports `isAbort: false`
 * because that flag means *the client* aborted. The React hook has no way to
 * tell the turn was cut short, so the thread simply stops — and if the model
 * had only made tool calls by then, with no text yet, the buyer is left with a
 * spinner that vanished and nothing where the answer should be.
 *
 * An error chunk is unambiguous: the client throws it, sets `status: "error"`,
 * and the thread renders it. Same event, told properly.
 */
export function reportAbortAsError(
  stream: ReadableStream<UIMessageChunk>
): ReadableStream<UIMessageChunk> {
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === "abort") {
          controller.enqueue({
            errorText: describeTurnFailure(chunk.reason),
            type: "error",
          });

          return;
        }

        controller.enqueue(chunk);
      },
    })
  );
}

/**
 * What to say when a turn fails, in the buyer's terms rather than the SDK's.
 *
 * The AI SDK masks errors out of the stream by default, which is a sound
 * default for a library and the wrong one here: the masked error is why a
 * stalled turn shows as an eternal spinner instead of a message. Everything
 * below is deliberately about what happened and what to do, never a provider
 * name or a stack trace.
 */
export function describeTurnFailure(error: unknown): string {
  if (isAbortError(error)) {
    return `The assistant took longer than ${Math.round(turnBudgetMs() / 1000)} seconds and was stopped. The model provider is likely slow or queueing right now — send that again, or try once more in a minute.`;
  }

  if (isQuotaShaped(error)) {
    return "The model provider is rate-limiting this store's key right now. Nothing was charged and nothing was lost — try again in a minute.";
  }

  return "The assistant hit an error and could not finish that turn. Nothing was charged. Send it again, and if it keeps happening tell the store.";
}

function isAbortError(error: unknown): boolean {
  // The abort chunk carries its reason as a string, not an Error.
  if (typeof error === "string") {
    const reason = error.toLowerCase();

    return reason.includes("abort") || reason.includes("timeout");
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const { name } = error as { name?: string };

  if (name === "AbortError" || name === "TimeoutError") {
    return true;
  }

  // The deadline does not always arrive as a named AbortError. It fires inside
  // a tool call or a model request, and what reaches here is often that call's
  // own error with the abort only named in its message — so the text is
  // checked too, or a timed-out turn is reported as an unexplained failure.
  const message = (error as { message?: string }).message?.toLowerCase() ?? "";

  return (
    message.includes("aborted") ||
    message.includes("timeouterror") ||
    message.includes("due to timeout")
  );
}

function isQuotaShaped(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const status = (error as { statusCode?: number }).statusCode;

  if (status === 429) {
    return true;
  }

  const message = (error as { message?: string }).message?.toLowerCase() ?? "";

  return (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests")
  );
}
