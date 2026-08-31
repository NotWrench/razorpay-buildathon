import { db, type Merchant, merchants } from "@workspace/db";
import { eq } from "drizzle-orm";
import Razorpay from "razorpay";
import { getRazorpayEnv } from "./env";
import { PaymentError } from "./errors";

export interface RazorpayCredentials {
  /** Public key id — safe to hand to the browser checkout. */
  keyId: string;
  /** Secret used for API auth and signature verification. Never leak this. */
  keySecret: string;
  /** OAuth access token, used instead of key/secret for connected accounts. */
  oauthToken?: string;
}

/** Platform-level credentials from the environment. */
export function getPlatformCredentials(): RazorpayCredentials {
  const env = getRazorpayEnv();

  return { keyId: env.keyId, keySecret: env.keySecret };
}

export function createRazorpayClient(
  credentials: RazorpayCredentials = getPlatformCredentials()
): Razorpay {
  if (credentials.oauthToken) {
    return new Razorpay({ oauthToken: credentials.oauthToken });
  }

  return new Razorpay({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
}

/**
 * Resolves the credentials to use for a merchant: its own connected Razorpay
 * account when present, otherwise the platform account.
 */
export function resolveMerchantCredentials(
  merchant: Merchant
): RazorpayCredentials {
  if (merchant.razorpayAccessToken) {
    return {
      keyId: merchant.razorpayKeyId ?? getPlatformCredentials().keyId,
      keySecret: merchant.razorpayKeySecret ?? "",
      oauthToken: merchant.razorpayAccessToken,
    };
  }

  if (merchant.razorpayKeyId && merchant.razorpayKeySecret) {
    return {
      keyId: merchant.razorpayKeyId,
      keySecret: merchant.razorpayKeySecret,
    };
  }

  return getPlatformCredentials();
}

export async function getMerchantOrThrow(
  merchantId: string
): Promise<Merchant> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
  });

  if (!merchant) {
    throw new PaymentError(
      "MERCHANT_NOT_FOUND",
      `No merchant found for id ${merchantId}`
    );
  }

  return merchant;
}

export interface MerchantGateway {
  client: Razorpay;
  credentials: RazorpayCredentials;
  merchant: Merchant;
}

/** Loads a merchant and an API client bound to its Razorpay account. */
export async function getMerchantGateway(
  merchantId: string
): Promise<MerchantGateway> {
  const merchant = await getMerchantOrThrow(merchantId);
  const credentials = resolveMerchantCredentials(merchant);

  return { client: createRazorpayClient(credentials), credentials, merchant };
}
