/*
 * `mandates.ts` reaches the database and the gateway. Nothing under test here
 * does either — this covers the instrument choice and what the simulated path
 * writes, which are the two things that must not drift silently.
 */
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5443/razorpay_project";
process.env.AGENT_DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

import { describe, expect, test } from "bun:test";
import type { BuyerMandate, Order } from "@workspace/db";
import type { MerchantGateway } from "../src/client";
import type { PaymentContext } from "../src/settlement";

const { instrumentFor } = await import("../src/mandates");

function mandate(overrides: Partial<BuyerMandate> = {}): BuyerMandate {
  return {
    buyerContact: "9123456789",
    buyerEmail: "buyer@example.com",
    buyerIdentifier: "buyer@example.com",
    createdAt: new Date(),
    expiresAt: new Date("2026-12-31"),
    id: "11111111-2222-3333-4444-555555555555",
    instrument: "simulated",
    maxPerOrderPaise: 5_000_000,
    maxTotalPaise: 20_000_000,
    merchantId: "store-1",
    razorpayCustomerId: null,
    razorpayTokenId: null,
    revokedAt: null,
    spentPaise: 0,
    updatedAt: new Date(),
    userId: null,
    ...overrides,
  } as BuyerMandate;
}

const order = {
  currency: "INR",
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  merchantId: "store-1",
  razorpayOrderId: "order_test_1",
  totalAmount: 250_000,
} as Order;

describe("instrumentFor", () => {
  test("a mandate with no recurring entitlement settles without the gateway", async () => {
    const result = await instrumentFor(mandate()).charge({
      gateway: {} as MerchantGateway,
      mandate: mandate(),
      order,
      payment: {} as PaymentContext,
    });

    expect(result.simulated).toBe(true);
  });

  /*
   * Anything `pay_`-shaped will eventually be pasted into a Razorpay dashboard
   * search and come back "not found" with no explanation. `sim_` is
   * unmistakable at a glance and in a grep, which is the entire point of
   * labelling a simulation rather than hiding it.
   */
  test("a simulated payment id cannot be mistaken for a Razorpay one", async () => {
    const result = await instrumentFor(mandate()).charge({
      gateway: {} as MerchantGateway,
      mandate: mandate(),
      order,
      payment: {} as PaymentContext,
    });

    expect(result.razorpayPaymentId.startsWith("sim_")).toBe(true);
    expect(result.razorpayPaymentId.startsWith("pay_")).toBe(false);
  });

  test("a recurring mandate refuses rather than charging without a token", async () => {
    const recurring = mandate({ instrument: "recurring" });

    await expect(
      instrumentFor(recurring).charge({
        gateway: {} as MerchantGateway,
        mandate: recurring,
        order,
        payment: {} as PaymentContext,
      })
    ).rejects.toThrow("no payment token");
  });

  test("a recurring mandate refuses rather than charging without contact details", async () => {
    const recurring = mandate({
      buyerContact: null,
      buyerEmail: null,
      instrument: "recurring",
      razorpayCustomerId: "cust_test_1",
      razorpayTokenId: "token_test_1",
    });

    await expect(
      instrumentFor(recurring).charge({
        gateway: {} as MerchantGateway,
        mandate: recurring,
        order,
        payment: {} as PaymentContext,
      })
    ).rejects.toThrow("contact details");
  });
});
