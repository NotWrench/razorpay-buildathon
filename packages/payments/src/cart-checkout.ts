import {
  cartCheckoutLines,
  markCartOrdered,
  validateCartBuilds,
} from "@workspace/commerce/carts";
import type { CompatibilityIssue } from "@workspace/commerce/compatibility";
import { PaymentError } from "./errors";
import {
  type CheckoutOrder,
  type CreateCheckoutOrderInput,
  createCheckoutOrder,
} from "./orders";

/**
 * Checking out a persisted cart.
 *
 * The reason this lives beside the money path rather than in a tool: §4's
 * guarantee has to be a property of the checkout, not of the prompt. An agent
 * that forgets to validate, a client that posts straight to the API, a future
 * MCP caller — all of them go through here, and all of them are refused the
 * same way. A tool-level check would only bind the one caller that remembered
 * to run it.
 *
 * Everything after validation is the existing `createCheckoutOrder` unchanged.
 * Pricing, the approval status, the Razorpay handoff and the audit entry are
 * untouched — this adds a gate in front of the money path and nothing else.
 */

export interface CartCheckoutInput
  extends Omit<CreateCheckoutOrderInput, "items"> {
  cartId: string;
}

export class BuildIncompatibleError extends PaymentError {
  readonly issues: CompatibilityIssue[];

  constructor(issues: CompatibilityIssue[]) {
    super(
      "BUILD_INCOMPATIBLE",
      `This build cannot be ordered as it stands: ${issues
        .map((issue) => issue.message)
        .join(" ")}`,
      { issues }
    );
    this.issues = issues;
    this.name = "BuildIncompatibleError";
  }
}

/**
 * Creates an order from a cart, refusing one whose builds do not validate.
 *
 * Validation runs against the cart's own lines, immediately before pricing, so
 * a build edited after it was last checked cannot slip through on a stale
 * `validated` status.
 *
 * Only `blocking` findings refuse. A build with an unknown specification is
 * reported and still sold, because declining to sell a card whose distributor
 * publishes no dimensions would serve nobody — what §4 forbids is doing it
 * quietly, and the warnings come back on the result.
 */
export async function createCheckoutOrderFromCart(
  input: CartCheckoutInput
): Promise<CheckoutOrder & { warnings: CompatibilityIssue[] }> {
  const scope = {
    buyerIdentifier: input.buyerIdentifier,
    cartId: input.cartId,
    merchantId: input.merchantId,
  };

  const validations = await validateCartBuilds(scope);

  const blocking = validations.flatMap((entry) =>
    entry.validation.issues.filter((issue) => issue.severity === "blocking")
  );

  if (blocking.length > 0) {
    throw new BuildIncompatibleError(blocking);
  }

  const warnings = validations.flatMap((entry) =>
    entry.validation.issues.filter((issue) => issue.severity === "warning")
  );

  const items = await cartCheckoutLines(scope);

  const result = await createCheckoutOrder({ ...input, items });

  await markCartOrdered(input.cartId, result.order.id);

  return { ...result, warnings };
}
