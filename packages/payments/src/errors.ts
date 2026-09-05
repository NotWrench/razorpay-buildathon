export type PaymentErrorCode =
  | "BUILD_INCOMPATIBLE"
  | "INVALID_SIGNATURE"
  | "LIVE_MODE_REFUSED"
  | "MANDATE_REFUSED"
  | "MERCHANT_NOT_FOUND"
  | "MERCHANT_NOT_CONNECTED"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_APPROVED"
  | "ORDER_ALREADY_PAID"
  | "PAYMENT_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "EMPTY_CART"
  | "RAZORPAY_API_ERROR"
  | "WEBHOOK_SECRET_MISSING";

const STATUS_BY_CODE: Record<PaymentErrorCode, number> = {
  BUILD_INCOMPATIBLE: 409,
  EMPTY_CART: 400,
  INVALID_SIGNATURE: 400,
  LIVE_MODE_REFUSED: 409,
  MANDATE_REFUSED: 409,
  MERCHANT_NOT_CONNECTED: 409,
  MERCHANT_NOT_FOUND: 404,
  ORDER_ALREADY_PAID: 409,
  ORDER_NOT_APPROVED: 409,
  ORDER_NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  PAYMENT_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  RAZORPAY_API_ERROR: 502,
  WEBHOOK_SECRET_MISSING: 500,
};

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: PaymentErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

/**
 * What to say when Razorpay refuses and does not explain itself.
 *
 * Most rejections carry `error.description` — "the amount is more than the
 * amount captured" — and that sentence is the best thing to show a merchant.
 * Some carry nothing at all: the SDK throws `{ statusCode: 404 }` with an
 * undefined body, which used to reach the merchant as "Unknown Razorpay
 * error". That is the least useful thing a payment screen can say, and it
 * lands at the exact moment somebody is anxious about money.
 *
 * The status is not much, but it is a fact, and it points somewhere.
 */
const STATUS_MEANING: Record<number, string> = {
  400: "Razorpay rejected the request as invalid. The amount or the payment state is probably not what we think it is.",
  401: "Razorpay did not accept this store's API credentials. Reconnect the payment account.",
  404: "Razorpay has no record of that payment. It may belong to a different account, or to live mode rather than test mode.",
  429: "Razorpay is rate-limiting this account. Wait a moment and try again.",
  500: "Razorpay had an internal error. Nothing was changed here; try again shortly.",
  502: "Razorpay was unreachable. Nothing was changed here; try again shortly.",
};

/** Normalizes anything thrown by the Razorpay SDK into a `PaymentError`. */
export function toPaymentError(error: unknown): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  const raw = error as {
    error?: { description?: string };
    statusCode?: number;
  } | null;

  const description =
    raw?.error?.description ??
    (error as Error | null)?.message ??
    (raw?.statusCode ? STATUS_MEANING[raw.statusCode] : undefined) ??
    (raw?.statusCode
      ? `Razorpay refused the request with HTTP ${raw.statusCode} and gave no reason.`
      : "Razorpay refused the request and gave no reason.");

  return new PaymentError("RAZORPAY_API_ERROR", description, error);
}
