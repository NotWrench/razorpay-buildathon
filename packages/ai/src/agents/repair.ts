import type { ToolCallRepairFunction, ToolSet } from "ai";

/**
 * Repairs tool calls the model's own control tokens have damaged.
 *
 * Two things break, and they break separately: the tool *name* arrives with
 * the tokens still attached, and the tool *arguments* arrive with a fragment
 * of the next line appended past the end of the JSON. Both are the same root
 * cause and both kill a turn over punctuation, so both are handled here.
 *
 * `openai/gpt-oss-*` speaks Harmony, a format where the model marks which
 * channel it is writing to — `analysis` for its reasoning, `commentary` for
 * tool calls, `final` for the buyer. NVIDIA NIM's OpenAI-compatible adapter
 * parses that back into `tool_calls` for us, and intermittently takes too much
 * of the line with it, so the name arrives as:
 *
 *     searchProducts<|channel|>commentary
 *
 * The SDK then correctly reports a tool that does not exist, and the whole
 * turn dies over a punctuation error. It is not reliably reproducible — four
 * identical requests produced it once — which is exactly why it needs handling
 * in code rather than a model that promises not to do it.
 *
 * The repair is deliberately narrow. It strips the control tokens and accepts
 * the result only if it is an *exact* name in the tool set. There is no fuzzy
 * matching and no nearest-neighbour guess: half these tools create orders and
 * payment links, and quietly redirecting a malformed call into a money action
 * would be a far worse bug than the one being fixed. Anything that does not
 * resolve exactly is left to fail, visibly.
 *
 * The argument repair holds the same line. It only ever *truncates* — it finds
 * where the top-level JSON value closes and discards whatever the adapter
 * wrote after it. It never adds a brace, never fills in a missing field and
 * never edits a value, so a repaired call carries exactly the arguments the
 * model sent and no others. A call malformed anywhere but its tail is left to
 * fail, and the SDK still validates the result against the tool's own schema
 * afterwards, so this cannot smuggle a wrong shape past the gate.
 */

/**
 * Everything from the first control token onwards.
 *
 * Harmony's tokens are `<|…|>`, so the first `<|` is where the tool name ended
 * and the model's own framing began.
 */
const CONTROL_TOKEN_TAIL = /<\|.*$/s;

/**
 * The `functions.` prefix Harmony uses to name a tool's recipient.
 *
 * Not seen in the wild here yet, but it is part of the same syntax and costs
 * one line to survive.
 */
const RECIPIENT_PREFIX = /^functions?\./;

export function cleanToolName(name: string): string {
  return name
    .replace(CONTROL_TOKEN_TAIL, "")
    .replace(RECIPIENT_PREFIX, "")
    .trim();
}

/** The `tool-` prefix a UI message part wears in front of its tool name. */
const UI_PART_PREFIX = "tool-";

/**
 * A UI part's type, with the model's control tokens stripped.
 *
 * The other half of the name repair, and the half that is easy to miss. The
 * tokens are already attached when `tool-input-start` streams, so the browser
 * builds a part typed `tool-askBuyer<|channel|>commentary` and keeps it —
 * repairing the call server-side fixes which tool *runs*, and does nothing
 * about which component *draws*.
 *
 * For a server-executed tool that costs a line of narration. For `askBuyer` it
 * costs the conversation: the question never renders, so the buyer cannot
 * answer it, so the turn waits for an answer that can no longer be given. The
 * observed symptom is a thread that sits on "Working…" forever.
 *
 * Unlike the name repair this cannot check the result against a tool set —
 * there is no tool set in the browser — but it does not need to. Nothing is
 * dispatched on the strength of this: it only decides which component draws a
 * part that already exists, and an unrecognised type falls through to the same
 * default it would have anyway.
 */
export function cleanToolPartType(type: string): string {
  if (!type.startsWith(UI_PART_PREFIX)) {
    return type;
  }

  return UI_PART_PREFIX + cleanToolName(type.slice(UI_PART_PREFIX.length));
}

/** Whether a string is a JSON document in its entirety. */
function parses(text: string): boolean {
  try {
    JSON.parse(text);

    return true;
  } catch {
    return false;
  }
}

/**
 * The index just past the string literal opening at `from`.
 *
 * Skipped wholesale so that a brace inside a product name — `Case {RGB}
 * Edition` — is never mistaken for structure. An unterminated literal returns
 * the end of the text, which the caller reads as "never balanced".
 */
function endOfString(text: string, from: number): number {
  for (let at = from + 1; at < text.length; at += 1) {
    const char = text[at];

    /* An escape consumes whatever follows it, a closing quote included. */
    if (char === "\\") {
      at += 1;
      continue;
    }

    if (char === '"') {
      return at + 1;
    }
  }

  return text.length;
}

/**
 * The text up to and including the close of the first top-level JSON value.
 *
 * Scanned rather than pattern-matched, because the junk NIM appends varies —
 * an extra `}`, a `<|call|>`, a fragment of the next channel — and the one
 * thing they have in common is where the *real* value ended. Strings are
 * tracked so a brace inside a product name is not mistaken for structure.
 *
 * Null when the text never balances, which includes the far more dangerous
 * case of a *truncated* call: arguments that stop mid-object are missing
 * something the model meant to say, and guessing at it is the one thing this
 * module refuses to do.
 */
function balancedPrefix(text: string): string | null {
  let depth = 0;
  let at = 0;

  while (at < text.length) {
    const char = text[at];

    if (char === '"') {
      at = endOfString(text, at);
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(0, at + 1);
      }

      /* A closer with nothing open: damage this cannot reason about. */
      if (depth < 0) {
        return null;
      }
    }

    at += 1;
  }

  return null;
}

/**
 * The arguments with the adapter's trailing fragment removed, or null.
 *
 * Null when there was nothing to fix. Arguments that already parse are left
 * exactly as they are, so a call that failed validation for an honest reason
 * — a missing field, a number where a string belongs — still fails.
 */
export function repairToolInput(input: string): string | null {
  if (parses(input)) {
    return null;
  }

  const prefix = balancedPrefix(input);

  if (prefix === null || prefix === input || !parses(prefix)) {
    return null;
  }

  return prefix;
}

/** The cleaned name, but only if cleaning it produced a real tool. */
function repairedName(toolName: string, tools: ToolSet): string | null {
  const cleaned = cleanToolName(toolName);

  if (cleaned === toolName || !(cleaned in tools)) {
    return null;
  }

  return cleaned;
}

/**
 * Builds the `repairToolCall` handler for a tool set.
 *
 * Returning null hands the original error back, which is the right answer for
 * anything this cannot resolve honestly — the buyer sees a failed turn rather
 * than a tool nobody asked for.
 */
export function repairHarmonyToolName<
  TOOLS extends ToolSet,
>(): ToolCallRepairFunction<TOOLS> {
  return ({ toolCall, tools }) => {
    /*
     * Both are attempted whichever error was raised. The SDK reports the first
     * problem it hits, and a call mangled badly enough to lose its name is one
     * whose arguments are worth checking too — repairing the name and handing
     * back a broken argument string only moves the failure one line down.
     */
    const name = repairedName(toolCall.toolName, tools);
    const input = repairToolInput(toolCall.input);

    if (name === null && input === null) {
      return Promise.resolve(null);
    }

    if (name !== null) {
      console.warn(
        `Repaired a tool name mangled by the model's control tokens: "${toolCall.toolName}" -> "${name}"`
      );
    }

    if (input !== null) {
      console.warn(
        `Trimmed what the model wrote past the end of ${name ?? toolCall.toolName}'s arguments: ${JSON.stringify(toolCall.input.slice(input.length))}`
      );
    }

    return Promise.resolve({
      ...toolCall,
      input: input ?? toolCall.input,
      toolName: name ?? toolCall.toolName,
    });
  };
}
