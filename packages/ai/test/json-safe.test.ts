import { describe, expect, test } from "bun:test";
import { tool } from "ai";
import { z } from "zod";
import { jsonSafeTools, toJsonValue } from "../src/tools/json-safe";

/**
 * The boundary that keeps a tool's output loadable back into a prompt.
 *
 * This exists because the failure it prevents is invisible everywhere else.
 * `activateCampaign` returned `endsAt` as a `Date`; the tool ran, the campaign
 * went live, and the *next* model call died on prompt validation — so the
 * merchant was told the turn failed and nothing had happened, about a campaign
 * that was already discounting orders. The agent suites never caught it
 * because they drive the tools through `generateText`, which does not validate
 * the prompt the way `streamText` does.
 */

describe("toJsonValue", () => {
  test("converts a Date to an ISO string", () => {
    expect(toJsonValue(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z"
    );
  });

  test("converts a Date nested in an ordinary output shape", () => {
    expect(
      toJsonValue({
        activated: true,
        endsAt: new Date("2026-01-02T03:04:05.000Z"),
        rows: [{ at: new Date("2026-01-02T03:04:05.000Z") }],
      })
    ).toEqual({
      activated: true,
      endsAt: "2026-01-02T03:04:05.000Z",
      rows: [{ at: "2026-01-02T03:04:05.000Z" }],
    });
  });

  test("keeps null, which means something in these outputs", () => {
    expect(toJsonValue({ budget: null, endsAt: null })).toEqual({
      budget: null,
      endsAt: null,
    });
  });

  test("drops undefined fields rather than emitting them", () => {
    expect(toJsonValue({ kept: 1, missing: undefined })).toEqual({ kept: 1 });
  });

  test("writes a bigint as a string instead of throwing", () => {
    expect(toJsonValue({ paise: 10n })).toEqual({ paise: "10" });
  });

  test("writes a non-finite number as null, as JSON does", () => {
    expect(toJsonValue({ ratio: Number.NaN })).toEqual({ ratio: null });
  });

  test("survives a cycle rather than hanging", () => {
    const node: Record<string, unknown> = { name: "loop" };

    node.self = node;

    expect(toJsonValue(node)).toEqual({ name: "loop" });
  });

  test("holds an array's positions when an element cannot be carried", () => {
    expect(toJsonValue([1, undefined, 3])).toEqual([1, null, 3]);
  });

  test("honours toJSON where a value defines one", () => {
    expect(toJsonValue({ amount: { toJSON: () => "₹500" } })).toEqual({
      amount: "₹500",
    });
  });
});

describe("jsonSafeTools", () => {
  const tools = jsonSafeTools({
    activate: tool({
      description: "Returns a timestamp the way the campaign tools do.",
      execute: () => ({ activated: true, endsAt: new Date(0) }),
      inputSchema: z.object({}),
    }),
    ask: tool({
      description: "Client-executed: there is no execute to wrap.",
      inputSchema: z.object({}),
    }),
  });

  test("converts what a tool returns", async () => {
    /*
     * Cast because the wrap is deliberately invisible to the type system: the
     * declared output still says `Date`, and the value handed to the model —
     * and to the UI card, which has always read it off the wire — is the ISO
     * string that `Date` was going to become anyway.
     */
    const output = (await tools.activate.execute?.({}, {
      context: {},
      messages: [],
      toolCallId: "call-1",
    } as never)) as unknown;

    expect(output).toEqual({
      activated: true,
      endsAt: "1970-01-01T00:00:00.000Z",
    });
  });

  test("leaves a tool with no execute alone", () => {
    expect(tools.ask.execute).toBeUndefined();
  });

  test("keeps the rest of the definition", () => {
    expect(tools.activate.description).toBe(
      "Returns a timestamp the way the campaign tools do."
    );
    expect(tools.activate.inputSchema).toBeDefined();
  });
});
