/*
 * `policy.ts` reaches the database to read one row, so importing it boots the
 * client. Nothing under test here touches it — the same trick the search
 * guardrail suite uses keeps the import from throwing on a missing env var.
 */
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5443/razorpay_project";
process.env.AGENT_DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

import { describe, expect, test } from "bun:test";

const { describePolicy, stricter } = await import("../src/policy");

type EffectivePolicy = Awaited<
  ReturnType<typeof import("../src/policy").getEffectivePolicy>
>;

/**
 * The rule that makes a merchant-editable bound safe to expose.
 *
 * `merchant_policy` is now writable from `/manager/account`, which means a
 * number a merchant typed reaches the same code path that decides whether a
 * discount is allowed. The only thing standing between those two facts is
 * `stricter`, so it is worth testing without a database in the way.
 *
 * The asymmetry is the whole point: a merchant may tighten anything and loosen
 * nothing, and loosening is *clamped silently* rather than refused — somebody
 * who types 50 into a field capped at 30 meant "as high as you'll let me", and
 * the effective value is shown back to them either way.
 */

const CEILING = 30;

describe("stricter", () => {
  test("a merchant may tighten", () => {
    expect(stricter(10, CEILING)).toBe(10);
  });

  test("a merchant may not loosen — the platform ceiling wins", () => {
    expect(stricter(80, CEILING)).toBe(CEILING);
  });

  test("exactly the ceiling is allowed", () => {
    expect(stricter(CEILING, CEILING)).toBe(CEILING);
  });

  test("zero is a real choice, not an absence", () => {
    expect(stricter(0, CEILING)).toBe(0);
  });

  test("null means the platform default, which is different from zero", () => {
    expect(stricter(null, CEILING)).toBe(CEILING);
    expect(stricter(undefined, CEILING)).toBe(CEILING);
  });

  test("a negative is floored at zero rather than inverting the bound", () => {
    expect(stricter(-5, CEILING)).toBe(0);
  });
});

/** The sentences the agent quotes and the discovery manifest publishes. */
function policy(overrides: Partial<EffectivePolicy> = {}): EffectivePolicy {
  return {
    agentOrdersRequireApproval: true,
    autoApproveCeilingPaise: 0,
    marginFloorPercent: 0,
    maxDiscountPercent: 30,
    maxPriceMovePercent: 20,
    merchantConfigured: false,
    spendCapPaise: 5_000_000,
    ...overrides,
  };
}

describe("describePolicy", () => {
  test("states every bound a counterparty needs before it engages", () => {
    const lines = describePolicy(policy());

    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("30%");
    expect(lines[1]).toContain("20%");
    expect(lines[3]).toContain("50,000");
  });

  test("a zero margin floor is described as 'never below cost'", () => {
    expect(describePolicy(policy())[2]).toBe("Nothing may be sold below cost.");
  });

  test("a real margin floor is quoted as a percentage", () => {
    expect(describePolicy(policy({ marginFloorPercent: 12 }))[2]).toContain(
      "12%"
    );
  });

  test("approval on says every agent order waits", () => {
    expect(describePolicy(policy())[4]).toContain("waits for a human");
  });

  /*
   * The one bound a merchant may loosen. If they do, the sentence has to say
   * so plainly and name the number — a counterparty agent reading the manifest
   * is deciding whether to engage on exactly this fact.
   */
  test("approval off names the unattended ceiling instead", () => {
    const [, , , , line] = describePolicy(
      policy({
        agentOrdersRequireApproval: false,
        autoApproveCeilingPaise: 250_000,
      })
    );

    expect(line).toContain("2,500");
    expect(line).toContain("do not wait");
  });
});
