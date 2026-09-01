import { agentDb, agentToolCalls } from "@workspace/db";
import type { AgentContext } from "./context";

/**
 * Per-tool-call telemetry (§24).
 *
 * Written from the AI SDK's own execution callbacks rather than by wrapping
 * each tool. That matters more than it looks: a wrapper is something every
 * new tool has to remember to apply, and the one that forgets is invisible
 * precisely because it produces no rows. Hooking the loop means a tool cannot
 * be added that escapes the telemetry.
 *
 * Everything here is best-effort. A logging failure must never break a turn
 * the buyer is in the middle of, so the writes are guarded and the errors go
 * to the console — the same rule the transcript persistence already follows.
 */

export type AgentType = "customer" | "admin";

/** Bounded stringification, so one enormous result cannot bloat the table. */
const MAX_INPUT_KEYS = 40;
const MAX_STRING = 500;

function trimValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]`
      : value;
  }

  if (Array.isArray(value)) {
    return value.length > 20
      ? { items: value.length, sample: value.slice(0, 3).map(trimValue) }
      : value.map(trimValue);
  }

  return value;
}

function trimInput(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .slice(0, MAX_INPUT_KEYS)
      .map(([key, value]) => [key, trimValue(value)])
  );
}

/**
 * A description of the output, not the output.
 *
 * A full tool result can be an entire catalog page; keeping every one would
 * turn an observability table into a second copy of the database. What is
 * useful later is shape and size — enough to notice a tool that has quietly
 * started returning nothing.
 */
function summariseOutput(output: unknown): Record<string, unknown> | null {
  if (output === null || output === undefined) {
    return { type: "empty" };
  }

  if (Array.isArray(output)) {
    return { count: output.length, type: "array" };
  }

  if (typeof output !== "object") {
    return { type: typeof output, value: trimValue(output) };
  }

  const record = output as Record<string, unknown>;

  return {
    keys: Object.keys(record).slice(0, MAX_INPUT_KEYS),
    // Counts for the fields a caller usually cares about the size of.
    sizes: Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, (value as unknown[]).length])
    ),
    type: "object",
  };
}

/**
 * Rounds a measurement to the integer its column stores.
 *
 * `toolExecutionMs` comes from a high-resolution clock, so a fast tool reports
 * something like 8.684300000000803 — which Postgres rejects outright for an
 * `integer` column, and the write is best-effort, so the rejection was silent
 * apart from a console line. Milliseconds are the unit the column is in and
 * sub-millisecond precision buys nothing for "what is the median latency",
 * so it is rounded here, at the one boundary every caller passes through.
 *
 * Null stays null: "not measured" and "measured at under half a millisecond"
 * are different facts and both are worth keeping.
 */
function toInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export interface ToolCallRecord {
  agentType: AgentType;
  errorText?: string | null;
  input?: unknown;
  latencyMs?: number | null;
  mode?: string | null;
  output?: unknown;
  status: "ok" | "error" | "denied";
  stepNumber?: number | null;
  toolCallId?: string | null;
  toolName: string;
}

export async function recordToolCall(
  ctx: AgentContext,
  record: ToolCallRecord
): Promise<void> {
  try {
    await agentDb.insert(agentToolCalls).values({
      agentType: record.agentType,
      conversationId: ctx.conversationId,
      errorText: record.errorText ?? null,
      input: trimInput(record.input),
      latencyMs: toInteger(record.latencyMs),
      mode: record.mode ?? null,
      outputSummary:
        record.status === "ok" ? summariseOutput(record.output) : null,
      status: record.status,
      stepNumber: toInteger(record.stepNumber),
      toolCallId: record.toolCallId ?? null,
      toolName: record.toolName,
    });
  } catch (error) {
    console.error("Failed to record a tool call", error);
  }
}

/**
 * Builds the `onToolExecutionEnd` handler for a turn.
 *
 * The SDK reports success and failure through one callback, discriminated on
 * `toolOutput.type`, so both land in the same row shape and a failing tool is
 * as countable as a working one.
 */
export function toolCallRecorder(params: {
  agentType: AgentType;
  ctx: AgentContext;
  mode?: string | null;
}) {
  return async (event: {
    toolCall: { toolCallId?: string; toolName: string; input?: unknown };
    toolExecutionMs?: number;
    toolOutput?: { type?: string; output?: unknown; error?: unknown };
  }) => {
    const errored = event.toolOutput?.type === "tool-error";

    await recordToolCall(params.ctx, {
      agentType: params.agentType,
      errorText: errored
        ? String(
            (event.toolOutput?.error as Error | undefined)?.message ??
              event.toolOutput?.error
          ).slice(0, MAX_STRING)
        : null,
      input: event.toolCall.input,
      latencyMs: event.toolExecutionMs ?? null,
      mode: params.mode ?? null,
      output: event.toolOutput?.output,
      status: errored ? "error" : "ok",
      toolCallId: event.toolCall.toolCallId ?? null,
      toolName: event.toolCall.toolName,
    });
  };
}
