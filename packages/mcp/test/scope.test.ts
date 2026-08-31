import { describe, expect, test } from "bun:test";
import {
  CAPABILITIES,
  capabilitiesFor,
  findCapability,
  MCP_SCOPES,
} from "../src/capabilities";

/**
 * The scope split, tested without a database or a model.
 *
 * §17's risk is that an MCP endpoint has no UI in front of it, so these are
 * the assertions that would fail the day someone adds a merchant capability
 * and forgets the `scopes` field — which, given the default, is the mistake
 * worth catching.
 */

const MERCHANT_ONLY = ["inventory.summary", "sales.summary", "orders.summary"];

describe("capability scoping", () => {
  test("a customer connection cannot see merchant capabilities", () => {
    const names = capabilitiesFor("customer").map(
      (capability) => capability.name
    );

    for (const restricted of MERCHANT_ONLY) {
      expect(names).not.toContain(restricted);
    }
  });

  test("and cannot resolve one by name either", () => {
    for (const restricted of MERCHANT_ONLY) {
      expect(findCapability("customer", restricted)).toBeUndefined();
    }
  });

  test("a merchant connection reaches everything", () => {
    expect(capabilitiesFor("merchant")).toHaveLength(CAPABILITIES.length);
  });

  test("every capability names at least one scope", () => {
    expect(
      CAPABILITIES.every((capability) => capability.scopes.length > 0)
    ).toBe(true);
  });

  test("every declared scope is a real scope", () => {
    expect(
      CAPABILITIES.every((capability) =>
        capability.scopes.every((scope) =>
          (MCP_SCOPES as readonly string[]).includes(scope)
        )
      )
    ).toBe(true);
  });

  test("capability names are unique", () => {
    const names = CAPABILITIES.map((capability) => capability.name);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe("what is deliberately absent", () => {
  test("nothing exposes raw SQL or arbitrary queries", () => {
    expect(
      CAPABILITIES.some((capability) =>
        /sql|query|exec|eval|raw/i.test(capability.name)
      )
    ).toBe(false);
  });

  test("nothing that moves money is exposed at all", () => {
    expect(
      CAPABILITIES.some((capability) =>
        /order\.create|checkout|payment|refund|approve/i.test(capability.name)
      )
    ).toBe(false);
  });

  test("no capability takes an identity as an argument", () => {
    // Both come from the server-resolved context. A capability that accepted
    // either would let a caller read another store or shop as someone else.
    const forbidden = [
      "merchantId",
      "buyerIdentifier",
      "userId",
      "storeSlug",
      "conversationId",
    ];

    for (const capability of CAPABILITIES) {
      for (const field of forbidden) {
        expect(Object.keys(capability.inputSchema)).not.toContain(field);
      }
    }
  });
});
