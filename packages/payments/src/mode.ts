import { PaymentError } from "./errors";

/**
 * Test mode, enforced rather than assumed.
 *
 * Razorpay stamps the mode into the key id, so a key pair is the whole
 * declaration — there is no flag on the checkout window to set. That also
 * means a single pasted `rzp_live_` key is the difference between a demo and
 * a real charge, with nothing in between to catch it.
 *
 * So this build refuses live credentials outright: the platform keys, the
 * merchant's own connected keys, and anything handed to the browser checkout
 * all pass through here. `RAZORPAY_ALLOW_LIVE=true` is the deliberate way out
 * for a deployment that really does mean to take money.
 */

export type RazorpayMode = "live" | "test";

/** Reads the mode off the key id's own prefix. Unknown shapes read as live. */
export function keyMode(keyId: string): RazorpayMode {
  return keyId.startsWith("rzp_test_") ? "test" : "live";
}

export function isTestKeyId(keyId: string): boolean {
  return keyMode(keyId) === "test";
}

/** Whether live keys are permitted at all. Off unless explicitly enabled. */
export function liveModeAllowed(): boolean {
  return process.env.RAZORPAY_ALLOW_LIVE === "true";
}

/**
 * Refuses a live key while the build is test-only.
 *
 * `source` names where the key came from, because "this store's connected
 * account" and "the server's own RAZORPAY_KEY_ID" are fixed in different
 * places and the message is the only thing that says which.
 */
export function assertTestMode(keyId: string, source: string): void {
  if (isTestKeyId(keyId) || liveModeAllowed()) {
    return;
  }

  throw new PaymentError(
    "LIVE_MODE_REFUSED",
    `${source} is a live Razorpay key (${keyId.slice(0, 8)}…). This build runs in test mode: use an rzp_test_ key, or set RAZORPAY_ALLOW_LIVE=true to take real payments.`
  );
}
