import { describe, expect, test } from "bun:test";
import { NoSuchToolError } from "ai";
import { cleanToolName, repairHarmonyToolName } from "../src/agents/repair";

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

function repair(toolName: string) {
  // The handler reads four of these fields; the rest of the SDK's option bag
  // is filled in only so the shape type-checks.
  return run({
    error: new NoSuchToolError({ availableTools: [], toolName }),
    inputSchema: () => Promise.resolve({}),
    instructions: undefined,
    messages: [],
    system: undefined,
    toolCall: {
      input: "{}",
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
