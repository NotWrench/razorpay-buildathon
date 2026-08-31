/**
 * Environment configuration for the Razorpay integration.
 *
 * Platform-level keys are used as the fallback for every merchant that has not
 * connected its own Razorpay account (see `merchants.razorpayKeyId`).
 */

export interface RazorpayEnv {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for the Razorpay integration`);
  }

  return value;
}

export function getRazorpayEnv(): RazorpayEnv {
  return {
    keyId: required("RAZORPAY_KEY_ID"),
    keySecret: required("RAZORPAY_KEY_SECRET"),
    webhookSecret: required("RAZORPAY_WEBHOOK_SECRET"),
  };
}

export function getPlatformWebhookSecret(): string {
  return required("RAZORPAY_WEBHOOK_SECRET");
}

/** Public base URL used to build callback / redirect URLs for payment links. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
