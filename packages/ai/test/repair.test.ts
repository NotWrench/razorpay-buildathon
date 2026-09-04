import { describe, expect, test } from "bun:test";
import { NoSuchToolError } from "ai";
import {
  cleanToolName,
  cleanToolPartType,
  repairHarmonyToolName,
  repairToolInput,
} from "../src/agents/repair";

/**
 * Recovering a tool name the model wrapped in its own control tokens.
 *
 * The bug this fixes appears roughly one call in four and cannot be summoned
 * on demand, so these tests are the only place the behaviour is actually
 * pinned down. The important half is what the repair *refuses* to do: half the
 * storefront tools create orders and payment links, and a repair that guessed
 * would turn a formatting glitch into a purchase.
 */

const TOOLS = {
  createOrder: {},
  getRequirements: {},
  searchProducts: {},
} as never;

const run = repairHarmonyToolName<typeof TOOLS>();

function repair(toolName: string, input = "{}") {
  // The handler reads four of these fields; the rest of the SDK's option bag
  // is filled in only so the shape type-checks.
  return run({
    error: new NoSuchToolError({ availableTools: [], toolName }),
    inputSchema: () => Promise.resolve({}),
    instructions: undefined,
    messages: [],
    system: undefined,
    toolCall: {
      input,
      toolCallId: "call-1",
      toolName,
      type: "tool-call",
    },
    tools: TOOLS,
  } as unknown as Parameters<typeof run>[0]);
}

describe("cleanToolName", () => {
  test("strips a Harmony channel marker", () => {
    expect(cleanToolName("searchProducts<|channel|>commentary")).toBe(
      "searchProducts"
    );
  });

  test("strips a recipient prefix", () => {
    expect(cleanToolName("functions.searchProducts")).toBe("searchProducts");
  });

  test("leaves a well-formed name alone", () => {
    expect(cleanToolName("searchProducts")).toBe("searchProducts");
  });
});

/**
 * The browser's half of the same repair.
 *
 * The control tokens are attached before `tool-input-start` streams, so the
 * part exists under the mangled type no matter what the server does with the
 * call. For `askBuyer` that decides whether the buyer is ever shown the
 * question, which decides whether the turn can ever finish.
 */
describe("cleanToolPartType", () => {
  test("strips the tokens from a part's tool name", () => {
    expect(cleanToolPartType("tool-askBuyer<|channel|>commentary")).toBe(
      "tool-askBuyer"
    );
  });

  test("leaves a well-formed part type alone", () => {
    expect(cleanToolPartType("tool-askBuyer")).toBe("tool-askBuyer");
  });

  test("leaves parts that are not tool calls alone", () => {
    // `reasoning` and `text` go through the same list.
    expect(cleanToolPartType("reasoning")).toBe("reasoning");
    expect(cleanToolPartType("step-start")).toBe("step-start");
  });
});

describe("repairHarmonyToolName", () => {
  test("repairs a mangled name that resolves to a real tool", async () => {
    const result = await repair("searchProducts<|channel|>commentary");

    expect(result?.toolName).toBe("searchProducts");
    // Everything else must survive: a repaired call with lost arguments would
    // run the right tool on the wrong input.
    expect(result?.input).toBe("{}");
    expect(result?.toolCallId).toBe("call-1");
  });

  test("refuses a name that is not a tool once cleaned", async () => {
    // The observed case: the model invented `sendMessage`. Failing visibly is
    // the correct answer — there is nothing here to route it to.
    expect(await repair("sendMessage<|channel|>commentary")).toBeNull();
  });

  test("never guesses at a near miss", async () => {
    // `searchProduct` is one character from a real tool and must still be
    // refused. The tools next to it in this set create orders.
    expect(await repair("searchProduct")).toBeNull();
    expect(await repair("createOrders")).toBeNull();
  });

  test("does not repair a name that was already correct", async () => {
    // Nothing to fix means the original error stands, rather than a pointless
    // retry of a call that will fail the same way.
    expect(await repair("searchProducts")).toBeNull();
  });
});

/**
 * Trimming what the adapter wrote past the end of the arguments.
 *
 * The observed failure was one surplus `}` on an otherwise perfect `askBuyer`
 * call, which cost the buyer the question. The half worth pinning down is
 * again the refusals: this only ever truncates, so anything it cannot fix by
 * deleting a tail must be left to fail rather than reshaped into something
 * that parses.
 */
describe("repairToolInput", () => {
  test("trims a surplus closing brace", () => {
    // Exactly what NIM sent: a complete object, then one more `}`.
    expect(repairToolInput('{"kind":"choice","field":"useCase"}}')).toBe(
      '{"kind":"choice","field":"useCase"}'
    );
  });

  test("trims a control token written past the arguments", () => {
    expect(repairToolInput('{"query":"rtx 4070"}<|call|>')).toBe(
      '{"query":"rtx 4070"}'
    );
  });

  test("keeps a brace that is inside a string", () => {
    // A product name may contain one, and cutting there would truncate the
    // value rather than the junk.
    const input = '{"name":"Case {RGB} Edition","note":"ok"}}';

    expect(repairToolInput(input)).toBe(
      '{"name":"Case {RGB} Edition","note":"ok"}'
    );
  });

  test("keeps an escaped quote from ending the string early", () => {
    const input = '{"name":"22\\" monitor","ok":true}}';

    expect(repairToolInput(input)).toBe('{"name":"22\\" monitor","ok":true}');
  });

  test("leaves well-formed arguments alone", () => {
    // Nothing to fix means the original validation error stands, rather than
    // a retry of a call that will fail the same way.
    expect(repairToolInput('{"amountPaise":120000}')).toBeNull();
  });

  test("refuses arguments that were cut off rather than overrun", () => {
    // A truncated call is missing something the model meant to send, and half
    // an order is far worse than a failed one.
    expect(repairToolInput('{"productId":"abc","quantity":')).toBeNull();
    expect(repairToolInput('{"productId":"abc"')).toBeNull();
  });

  test("refuses arguments that are not JSON at all", () => {
    expect(repairToolInput("commentary to=functions.createOrder")).toBeNull();
    expect(repairToolInput("")).toBeNull();
  });

  test("refuses a stray closer before anything opened", () => {
    expect(repairToolInput('}{"quantity":1}')).toBeNull();
  });
});

describe("repairHarmonyToolName argument repair", () => {
  test("trims the tail on a call whose name was already right", async () => {
    const result = await repair("searchProducts", '{"query":"gpu"}}');

    expect(result?.toolName).toBe("searchProducts");
    expect(result?.input).toBe('{"query":"gpu"}');
  });

  test("repairs a mangled name and its arguments in one pass", async () => {
    const result = await repair(
      "searchProducts<|channel|>commentary",
      '{"query":"gpu"}}'
    );

    expect(result?.toolName).toBe("searchProducts");
    expect(result?.input).toBe('{"query":"gpu"}');
  });

  test("declines when neither the name nor the arguments need fixing", async () => {
    expect(await repair("searchProducts", '{"query":"gpu"}')).toBeNull();
  });
});
