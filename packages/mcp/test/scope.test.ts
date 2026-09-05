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

/** Every capability a buyer may reach, so an accidental addition is visible. */
const CUSTOMER_CAPABILITIES = [
  "products.search",
  "products.get",
  "products.compare",
  "build.checkCompatibility",
  "build.get",
  "checkout.quote",
  "orders.create",
  "orders.status",
  "orders.cancel",
  "payment.link",
];

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

  test("a customer connection reaches exactly the buyer's set", () => {
    // Listed rather than counted, so adding a capability without deciding its
    // scope fails here with the name of the thing that was added.
    expect(
      capabilitiesFor("customer").map((capability) => capability.name).sort()
    ).toEqual([...CUSTOMER_CAPABILITIES].sort());
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

  /*
   * This used to assert that nothing touching money was exposed at all, which
   * was true and was also the reason an MCP-native buyer had to drop out of the
   * protocol to buy anything. The checkout capabilities are here now, so the
   * assertion has to become the sharper one: what a *buyer* may do is exposed,
   * and what only a merchant may do is not reachable from MCP at all.
   */
  test("a buyer's own money path is reachable", () => {
    const names = capabilitiesFor("customer").map(
      (capability) => capability.name
    );

    expect(names).toContain("checkout.quote");
    expect(names).toContain("orders.create");
    expect(names).toContain("orders.status");
    expect(names).toContain("orders.cancel");
    expect(names).toContain("payment.link");
  });

  test("nothing a merchant alone may do is exposed to anyone", () => {
    // Approving an order, refunding one, moving a price, running a campaign:
    // each of these decides for somebody else's money, and none has an MCP
    // door. `orders.create` is a buyer acting on their own behalf; these are
    // not.
    const forbidden =
      /refund|approve|reject|capture|campaign|price\.|discount|policy/i;

    expect(
      CAPABILITIES.some((capability) => forbidden.test(capability.name))
    ).toBe(false);
  });

  test("orders.create demands a stated reason", () => {
    const create = findCapability("customer", "orders.create");

    // Mandatory on the tool and mandatory here: it is what the approving
    // merchant reads, and an order that cannot say why it exists should not be
    // creatable over a transport with no conversation attached to it.
    expect(Object.keys(create?.inputSchema ?? {})).toContain("reason");
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
