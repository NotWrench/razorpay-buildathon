/*
 * `approval-policy.ts` reaches the database to read one merchant row, so
 * importing it boots the client. Nothing under test here touches it — the same
 * trick `packages/ai/test/policy.test.ts` uses keeps the import from throwing
 * on a missing env var.
 */
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5443/razorpay_project";
process.env.AGENT_DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

import { describe, expect, test } from "bun:test";

const { decideApproval } = await import("../src/approval-policy");

/**
 * The rule that decides whether a merchant is woken up.
 *
 * Tested against the pure function rather than through a seeded store, because
 * every interesting case here is a boundary case — exactly at the ceiling, one
 * paise over, a key stricter than the shop — and a bound only ever exercised
 * through a database is a bound nobody checks at the edges.
 */

const HUMAN = "human" as const;
const AGENT = "ai_agent" as const;

describe("decideApproval", () => {
  test("a person buying their own cart never waits for the merchant", () => {
    const decision = decideApproval({
      buyerType: HUMAN,
      ceilingPaise: 0,
      requiresApproval: true,
      totalAmount: 9_999_999,
    });

    expect(decision.status).toBe("approved");
  });

  test("the default store still reviews every agent order", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 0,
      requiresApproval: true,
      totalAmount: 1,
    });

    expect(decision.status).toBe("pending_approval");
  });

  test("the toggle alone does not open the gate — the total must fit too", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 250_000,
      requiresApproval: false,
      totalAmount: 250_001,
    });

    expect(decision.status).toBe("pending_approval");
    expect(decision.explanation).toContain("over this store's");
  });

  test("an agent order inside a merchant's stated ceiling clears", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 250_000,
      requiresApproval: false,
      totalAmount: 200_000,
    });

    expect(decision.status).toBe("approved");
    expect(decision.ceilingPaise).toBe(250_000);
  });

  test("exactly at the ceiling is inside it", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 250_000,
      requiresApproval: false,
      totalAmount: 250_000,
    });

    expect(decision.status).toBe("approved");
  });

  /*
   * A ceiling of zero with approval switched off is a merchant saying "I do
   * not review orders, and I permit nothing unattended" — contradictory as an
   * intention, but it must resolve to the safe reading rather than to a free
   * pass. Any positive total is over zero, so it queues.
   */
  test("a zero ceiling permits nothing, however the toggle is set", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 0,
      requiresApproval: false,
      totalAmount: 1,
    });

    expect(decision.status).toBe("pending_approval");
  });

  test("the explanation names the ceiling the merchant will read", () => {
    const decision = decideApproval({
      buyerType: AGENT,
      ceilingPaise: 250_000,
      requiresApproval: false,
      totalAmount: 200_000,
    });

    expect(decision.explanation).toContain("250000");
    expect(decision.explanation).toContain("200000");
  });
});
