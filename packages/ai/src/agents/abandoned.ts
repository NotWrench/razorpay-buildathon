import { cleanToolPartType } from "./repair";

/**
 * Settles tool calls the conversation walked away from.
 *
 * `askBuyer` is deliberately answerable in two ways: tap one of the options,
 * or ignore them and type what you actually want. The composer never disables
 * itself, and §3.2's whole point is that the buyer is not trapped in the
 * interview. But only the tap produces the tool's output — the typed reply
 * arrives as an ordinary user message, and the question is left standing with
 * a tool call and no result behind it.
 *
 * The next request replays that history, and the SDK refuses it:
 *
 *     AI_MissingToolResultsError: Tool result is missing for tool call call-…
 *
 * Which is correct — every provider requires a result for every call — but the
 * consequence is brutal. The error is thrown while building the prompt, before
 * a single token, so the buyer gets a failed turn; and because the poison is
 * in the history rather than in the message, every retry rebuilds the same
 * prompt and fails the same way. The observed symptom is a thread that dies
 * the moment somebody types their budget instead of tapping it, and cannot be
 * revived except by starting over. That is the exact failure the tool exists
 * to avoid.
 *
 * So an unanswered question is closed out here, on the way back to the model,
 * with the truth: the buyer answered in their own words instead. The message
 * they typed is the very next thing in the prompt, so the model reads the
 * answer immediately after being told where it came from.
 *
 * Server-executed calls left unsettled are a different animal — the turn was
 * cut off mid-flight by the deadline or a crash, and the tool genuinely has no
 * result. Those close as errors, because inventing an output for a tool that
 * never ran is how a model ends up reasoning over a search it never did.
 */

/**
 * The unsettled states worth closing out.
 *
 * These are exactly the states that reach the model as a tool call with no
 * result behind it. `input-streaming` is absent on purpose: the SDK drops
 * those parts entirely rather than emitting a call for them, so they cost
 * nothing, and inventing a result for arguments that never finished arriving
 * would be a guess.
 */
const ABANDONED = new Set(["approval-requested", "input-available"]);

/** Tools whose output only ever comes from the person, never the server. */
const CLIENT_TOOLS = new Set(["tool-askBuyer"]);

const TYPED_INSTEAD =
  "The buyer did not pick one of these options. They replied in their own " +
  "words instead — their message follows. Treat that as the answer to this " +
  "question, and do not ask it again.";

const NEVER_RAN =
  "This tool never ran: the previous turn ended before it finished. Nothing " +
  "was done and nothing was charged. Call it again if you still need it.";

interface ToolPartish {
  approval?: unknown;
  errorText?: string;
  output?: unknown;
  state?: string;
  type: string;
}

function isAbandoned(part: ToolPartish): boolean {
  return part.type.startsWith("tool-") && ABANDONED.has(part.state ?? "");
}

function settle(part: ToolPartish): ToolPartish {
  if (CLIENT_TOOLS.has(cleanToolPartType(part.type))) {
    return { ...part, output: TYPED_INSTEAD, state: "output-available" };
  }

  /*
   * The approval request goes with it. A call that is being closed as an
   * error is not waiting on anybody, and leaving the request in the prompt
   * asks the model to weigh a decision that is no longer open.
   */
  const { approval: _approval, ...rest } = part;

  return { ...rest, errorText: NEVER_RAN, state: "output-error" };
}

/**
 * The same settlement applied to a whole thread on its way to the model.
 *
 * Every message is checked rather than only the last one, because the history
 * a client replays can carry an abandoned question from any turn — including
 * one made in a tab that has been open since before this existed, and one
 * replayed out of the audit trail.
 *
 * Messages with nothing to settle are returned by identity, so a thread that
 * never had a problem is not rebuilt every turn.
 */
export function settleAbandonedToolCalls<
  TMessage extends { parts: ToolPartish[] },
>(messages: TMessage[]): TMessage[] {
  return messages.map((message) => {
    if (!message.parts.some(isAbandoned)) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) =>
        isAbandoned(part) ? settle(part) : part
      ),
    };
  });
}
