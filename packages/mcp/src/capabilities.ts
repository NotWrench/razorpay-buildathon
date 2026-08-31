import { z } from "zod";

/**
 * What this store exposes over MCP, and to whom.
 *
 * §17 wants the domain reachable by the wider agent ecosystem rather than only
 * by this app's own chat. The risk that comes with it is the whole design
 * problem: an MCP endpoint is a door with no UI in front of it, so the
 * authorization cannot live in a page or a prompt.
 *
 * Two rules hold it together.
 *
 * **One definition per capability.** Every entry below delegates to the same
 * tool the in-app agent calls. There is no second implementation of product
 * search to drift out of step with the first, and no second place to fix a
 * grounding bug.
 *
 * **Scope is checked before dispatch, not inside the handler.** A capability
 * names the scopes that may reach it, and `capabilitiesFor` never returns one
 * the caller is not entitled to — a customer-scoped connection is not told
 * `inventory.summary` exists, let alone allowed to call it. Nothing here
 * accepts a merchant id or a buyer identity as an argument; both come from the
 * server-resolved context, exactly as they do in the chat route.
 *
 * And nothing resembling `postgres.executeAnySql` appears here or ever should.
 *
 * This module is deliberately free of imports that reach a database or a
 * model. What a scope may touch is the security-relevant fact in this package,
 * and it should be auditable — and testable — without booting the app. The
 * implementations live in `./dispatch`.
 */

export const MCP_SCOPES = ["customer", "merchant"] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export interface McpCapability {
  description: string;
  /**
   * The raw shape rather than a built object.
   *
   * It is what `registerTool` takes, and it is what the SDK turns into the
   * JSON Schema a calling agent reads — so the argument validation an MCP
   * client sees is the same one this server enforces.
   */
  inputSchema: z.ZodRawShape;
  /** Dotted, e.g. `products.search`. */
  name: string;
  /** Scopes permitted to see and call it. */
  scopes: McpScope[];
  /** The agent tool this delegates to. Resolved in `./dispatch`. */
  tool: { name: string; set: ToolSetName };
}

/** Which of the agent's tool sets holds the implementation. */
export type ToolSetName = "shopping" | "builder" | "merchant";

const CUSTOMER: McpScope[] = ["customer", "merchant"];
const MERCHANT_ONLY: McpScope[] = ["merchant"];

export const CAPABILITIES: McpCapability[] = [
  {
    description:
      "Search this store's catalog. Returns real products with live prices and stock.",
    inputSchema: {
      budgetMaxPaise: z.number().int().positive().optional(),
      category: z.string().max(80).optional(),
      limit: z.number().int().min(1).max(12).default(6),
      query: z.string().min(2).max(300),
    },
    name: "products.search",
    scopes: CUSTOMER,
    tool: { name: "searchProducts", set: "shopping" },
  },
  {
    description: "Full detail and live stock for one product.",
    inputSchema: { productId: z.uuid() },
    name: "products.get",
    scopes: CUSTOMER,
    tool: { name: "getProduct", set: "shopping" },
  },
  {
    description:
      "Compare 2-4 products side by side on the attributes their category publishes.",
    inputSchema: { productIds: z.array(z.uuid()).min(2).max(4) },
    name: "products.compare",
    scopes: CUSTOMER,
    tool: { name: "compareProducts", set: "shopping" },
  },
  {
    description:
      "Check whether a set of PC components works together. Returns a status per rule, " +
      "including insufficient_data where a specification is missing.",
    inputSchema: {
      buildId: z.uuid().optional(),
      items: z
        .array(
          z.object({
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(10).default(1),
          })
        )
        .max(20)
        .optional(),
    },
    name: "build.checkCompatibility",
    scopes: CUSTOMER,
    tool: { name: "checkBuildCompatibility", set: "builder" },
  },
  {
    description:
      "The parts in one of your saved builds, with its compatibility status.",
    inputSchema: { buildId: z.uuid() },
    name: "build.get",
    scopes: CUSTOMER,
    tool: { name: "getBuild", set: "builder" },
  },
  {
    description:
      "Stock health across the store: units on hand, value, and what is below threshold.",
    inputSchema: {},
    name: "inventory.summary",
    scopes: MERCHANT_ONLY,
    tool: { name: "getInventorySummary", set: "merchant" },
  },
  {
    description: "Revenue, order count and average order value over a window.",
    inputSchema: {
      windowDays: z.number().int().min(1).max(365).default(30),
    },
    name: "sales.summary",
    scopes: MERCHANT_ONLY,
    tool: { name: "getSalesSummary", set: "merchant" },
  },
  {
    description:
      "Orders by status over a window, with how many await merchant approval.",
    inputSchema: {
      windowDays: z.number().int().min(1).max(365).default(30),
    },
    name: "orders.summary",
    scopes: MERCHANT_ONLY,
    tool: { name: "getOrderSummary", set: "merchant" },
  },
];

/** Only the capabilities this scope may see. The filter is the guard. */
export function capabilitiesFor(scope: McpScope): McpCapability[] {
  return CAPABILITIES.filter((capability) => capability.scopes.includes(scope));
}

export function findCapability(
  scope: McpScope,
  name: string
): McpCapability | undefined {
  return capabilitiesFor(scope).find((capability) => capability.name === name);
}
