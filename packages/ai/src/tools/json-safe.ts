import type { ToolSet } from "ai";

/**
 * Makes every tool's output JSON, before the SDK has to.
 *
 * A tool's return value is not merely logged — it is appended to the prompt as
 * a `tool-result` part and sent back to the model on the next step, and
 * `streamText` validates the whole prompt against `ModelMessage[]` before each
 * of those calls. That schema wants JSON. A `Date` is not JSON: it survives
 * the tool, survives the step, and then fails validation on the *following*
 * model call with `AI_InvalidPromptError: The messages do not match the
 * ModelMessage[] schema` — a message that names neither the tool nor the field
 * that caused it.
 *
 * Which produced the worst failure this system had. `activateCampaign`
 * returned `endsAt` as a `Date`; the merchant pressed Approve, the campaign
 * went live, and the turn that would have said so died on the next model call.
 * The merchant was shown "the assistant hit an error… nothing was charged"
 * over a campaign that was, at that moment, discounting live orders. Every
 * tool that hands back a database timestamp — `listCampaigns`,
 * `getAgentOrderQueue`, `getPriceHistory`, `explainDecision` — is one press
 * away from the same thing.
 *
 * So the conversion happens once, here, at the boundary where a tool's output
 * becomes part of a prompt, rather than in each tool where it can be forgotten
 * again. `Date` becomes an ISO string, which is what the model would have been
 * shown anyway had it made it through the wire.
 *
 * Note that `generateText` does not validate the prompt this way, which is why
 * the agent suites never saw any of this: they run the same tools through the
 * non-streaming path, and the app streams. `test/json-safe.test.ts` covers the
 * conversion directly for that reason.
 */

/** A value that is safe to put in a `tool-result` part. */
type Json = boolean | Json[] | null | number | string | { [key: string]: Json };

/**
 * The value as JSON, or `undefined` where there is nothing JSON can carry.
 *
 * Deliberately not `JSON.parse(JSON.stringify(value))`: that throws on a
 * `bigint` and on a cycle, which would turn a tool that merely returned an odd
 * value into a tool that failed. Nothing here throws — the worst case is a
 * field quietly dropped, which the model reads as "not provided" rather than
 * as a broken turn.
 */
export function toJsonValue(
  value: unknown,
  seen = new WeakSet()
): Json | undefined {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      // NaN and Infinity are not JSON either, and `JSON.stringify` writes them
      // as null. Same answer, reached deliberately.
      return Number.isFinite(value) ? value : null;
    case "bigint":
      return value.toString();
    case "function":
    case "symbol":
    case "undefined":
      return undefined;
    default:
      break;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const object = value as object;

  /* A cycle cannot be represented and must not hang the conversion. */
  if (seen.has(object)) {
    return undefined;
  }

  seen.add(object);

  if (Array.isArray(value)) {
    // An array's holes are positional, so a dropped element would shift every
    // one after it. Null is what `JSON.stringify` writes there too.
    return value.map((item) => toJsonValue(item, seen) ?? null);
  }

  if (value instanceof Map || value instanceof Set) {
    return toJsonValue([...value], seen) ?? null;
  }

  /*
   * `toJSON` is how a value says what it is on the wire — Drizzle's numerics
   * and the SDK's own error shapes both use it — so it is honoured before the
   * generic object walk, which would otherwise return the internals.
   */
  const custom = (value as { toJSON?: () => unknown }).toJSON;

  if (typeof custom === "function") {
    return toJsonValue(custom.call(value), seen);
  }

  const result: Record<string, Json> = {};

  for (const [key, entry] of Object.entries(value)) {
    const converted = toJsonValue(entry, seen);

    if (converted !== undefined) {
      result[key] = converted;
    }
  }

  return result;
}

/**
 * The same tool set, with every executable tool's output converted to JSON.
 *
 * The type is preserved on purpose: `InferUITools` is derived from these tool
 * definitions and the UI cards are typed off that, so the wrap has to be
 * invisible to the type system. It only ever changes the *representation* of a
 * value the model was going to be shown as text anyway.
 */
export function jsonSafeTools<T extends ToolSet>(tools: T): T {
  const wrapped: ToolSet = {};

  for (const [name, definition] of Object.entries(tools)) {
    const { execute } = definition;

    if (typeof execute !== "function") {
      // Client-executed tools — `askBuyer` — have no `execute` here at all.
      wrapped[name] = definition;
      continue;
    }

    wrapped[name] = {
      ...definition,
      execute: async (input: never, options: never) => {
        const output = await execute(input, options);

        return toJsonValue(output);
      },
    } as ToolSet[string];
  }

  return wrapped as T;
}
