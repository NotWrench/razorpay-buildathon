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
export type ToolSetName = "shopping" | "builder" | "checkout" | "merchant";

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
  /*
   * The money path.
   *
   * Until these existed an MCP-native buyer could browse the store, validate a
   * build and compare parts — then had to drop out of MCP entirely and
   * hand-roll REST calls to buy anything. "Transactable end to end" was true
   * over HTTP and false over the protocol built to make it true.
   *
   * Exposing them changes no bound. Each delegates to the tool the in-app agent
   * already calls, so the spend cap is checked inside `execute` before any
   * write, and `createCheckoutOrder` still stamps an agent order
   * `pending_approval` with no Razorpay order behind it. What the caller gets
   * here is exactly what `POST /api/payments/orders` already gives the same
   * identity — which is the invariant this endpoint has always claimed.
   *
   * What does move is *where the human presses the button*. The in-app agent
   * suspends its loop for an approval card; an MCP client has no such loop, and
   * its own host is the surface that asks its user before calling a tool. That
   * is the standard shape, and it is why the guarantee that matters was never
   * the gate — it is the database refusing to attach a payment instrument to an
   * order no merchant has approved.
   */
  {
    description:
      "Price a set of items: line items, subtotal, any active campaign discount, " +
      "and the total in paise. Charges nothing and creates nothing. Call this " +
      "before orders.create so the buyer sees the price they are agreeing to.",
    inputSchema: {
      items: z
        .array(
          z.object({
            isUpsell: z.boolean().default(false),
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(10),
          })
        )
        .min(1)
        .max(20),
    },
    name: "checkout.quote",
    scopes: CUSTOMER,
    tool: { name: "quoteOrder", set: "shopping" },
  },
  {
    description:
      "Create an order the buyer has agreed to. Charges nothing. An order from " +
      "an API-key buyer is created pending_approval with no payment instrument " +
      "attached — a human merchant must approve it before it can be paid. " +
      "aiPurchaseReason is mandatory and is shown to that merchant.",
    inputSchema: {
      cartId: z
        .uuid()
        .optional()
        .describe("Order a saved cart. Omit to pass items."),
      items: z
        .array(
          z.object({
            isUpsell: z.boolean().default(false),
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(10),
          })
        )
        .min(1)
        .max(20)
        .optional(),
      reason: z
        .string()
        .min(20)
        .max(2000)
        .describe(
          "Why this exact cart, in plain language. Stored on the order and " +
            "read by the merchant who approves or rejects you."
        ),
    },
    name: "orders.create",
    scopes: CUSTOMER,
    tool: { name: "createOrder", set: "checkout" },
  },
  {
    description:
      "Current state of one of your own orders: approval status, payment " +
      "attempts, any failure with its reason, and the recovery options open to " +
      "you. Poll this to observe a merchant's approval decision.",
    inputSchema: { orderId: z.uuid() },
    name: "orders.status",
    scopes: CUSTOMER,
    tool: { name: "getOrderStatus", set: "checkout" },
  },
  {
    description:
      "Cancel one of your own unpaid orders. Records why. An order that has " +
      "already been paid needs a refund, not a cancellation, and is refused.",
    inputSchema: {
      orderId: z.uuid(),
      reason: z.string().min(5).max(500),
    },
    name: "orders.cancel",
    scopes: CUSTOMER,
    tool: { name: "cancelOrder", set: "checkout" },
  },
  {
    description:
      "Issue a hosted Razorpay payment link for an order the merchant has " +
      "approved. The link goes to a human; no card details pass through the " +
      "calling agent. Refused for an order still awaiting approval.",
    inputSchema: { orderId: z.uuid() },
    name: "payment.link",
    scopes: CUSTOMER,
    tool: { name: "createPaymentLink", set: "checkout" },
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
