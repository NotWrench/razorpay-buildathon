/*
 * `mandate-policy.ts` reaches the database to find a buyer's row, so importing
 * it boots the client. Nothing under test here touches it.
 */
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5443/razorpay_project";
process.env.AGENT_DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

import { describe, expect, test } from "bun:test";
import type { MandateBounds } from "../src/mandate-policy";

const { checkMandate } = await import("../src/mandate-policy");

/**
 * The rule that decides whether an agent may pay without asking anyone.
 *
 * Every case here is a boundary case, which is why the clock is a parameter:
 * an expiry rule tested against `Date.now()` is a test that passes until the
 * day it does not.
 */

const NOW = new Date("2026-09-05T12:00:00Z");
const STORE = "store-1";

function mandate(overrides: Partial<MandateBounds> = {}): MandateBounds {
  return {
    expiresAt: new Date("2026-12-31T00:00:00Z"),
    maxPerOrderPaise: 5_000_000,
    maxTotalPaise: 20_000_000,
    merchantId: STORE,
    revokedAt: null,
    spentPaise: 0,
    ...overrides,
  };
}

function check(m: MandateBounds, totalPaise: number) {
  return checkMandate(m, { merchantId: STORE, now: NOW, totalPaise });
}

describe("checkMandate", () => {
  test("an order inside every bound is allowed", () => {
    const result = check(mandate(), 3_000_000);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.remainingPaise).toBe(17_000_000);
  });

  test("a mandate given for another store cannot pay this one", () => {
    const result = check(mandate({ merchantId: "store-2" }), 1000);

    expect(result.reason).toBe("MANDATE_WRONG_STORE");
  });

  /*
   * Withdrawal is checked before expiry and before the caps, because "you took
   * this back" is the true answer even when the mandate is also out of money,
   * and it is the one the buyer needs to hear.
   */
  test("a withdrawn mandate refuses before any other reason is considered", () => {
    const result = check(
      mandate({
        expiresAt: new Date("2020-01-01T00:00:00Z"),
        revokedAt: new Date("2026-09-01T00:00:00Z"),
        spentPaise: 20_000_000,
      }),
      1000
    );

    expect(result.reason).toBe("MANDATE_REVOKED");
  });

  test("a lapsed mandate refuses and says when it lapsed", () => {
    const result = check(
      mandate({ expiresAt: new Date("2026-08-01T00:00:00Z") }),
      1000
    );

    expect(result.reason).toBe("MANDATE_EXPIRED");
    expect(result.message).toContain("Aug 01 2026");
  });

  test("expiry is not inclusive — the instant it lapses, it has lapsed", () => {
    const result = check(mandate({ expiresAt: NOW }), 1000);

    expect(result.reason).toBe("MANDATE_EXPIRED");
  });

  test("a single order over the per-order cap refuses even with headroom left", () => {
    const result = check(
      mandate({ maxPerOrderPaise: 5_000_000, maxTotalPaise: 20_000_000 }),
      5_000_001
    );

    expect(result.reason).toBe("MANDATE_OVER_PER_ORDER_CAP");
  });

  test("exactly at the per-order cap is inside it", () => {
    const result = check(mandate({ maxPerOrderPaise: 5_000_000 }), 5_000_000);

    expect(result.ok).toBe(true);
  });

  test("an order past the remaining total refuses and says by how much", () => {
    const result = check(
      mandate({ maxTotalPaise: 20_000_000, spentPaise: 18_000_000 }),
      3_000_000
    );

    expect(result.reason).toBe("MANDATE_EXHAUSTED");
    expect(result.message).toContain("₹10,000");
    expect(result.message).toContain("₹20,000");
  });

  test("spending the last paise is allowed; the next one is not", () => {
    const spent = mandate({ maxTotalPaise: 20_000_000, spentPaise: 19_900_000 });

    expect(check(spent, 100_000).ok).toBe(true);
    expect(check(spent, 100_001).reason).toBe("MANDATE_EXHAUSTED");
  });

  /*
   * Overspend should be impossible, but a row that has somehow gone past its
   * own total must not report negative headroom — a caller doing arithmetic on
   * `remainingPaise` would turn the breach into a larger allowance.
   */
  test("a mandate spent past its total reports no headroom, not negative", () => {
    const result = check(
      mandate({ maxTotalPaise: 20_000_000, spentPaise: 25_000_000 }),
      1000
    );

    expect(result.reason).toBe("MANDATE_EXHAUSTED");
    expect(result.remainingPaise).toBe(0);
  });

  test("every refusal says nothing was charged", () => {
    const refusals = [
      check(mandate({ revokedAt: NOW }), 1000),
      check(mandate({ expiresAt: new Date("2020-01-01") }), 1000),
      check(mandate({ maxPerOrderPaise: 1 }), 1000),
      check(mandate({ maxTotalPaise: 1, spentPaise: 1 }), 1000),
    ];

    for (const refusal of refusals) {
      expect(refusal.ok).toBe(false);
      expect(refusal.message).toContain("Nothing was charged");
    }
  });
});
