export type PaymentErrorCode =
  | "INVALID_SIGNATURE"
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
  EMPTY_CART: 400,
  INVALID_SIGNATURE: 400,
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

/** Normalizes anything thrown by the Razorpay SDK into a `PaymentError`. */
export function toPaymentError(error: unknown): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  const description =
    (error as { error?: { description?: string } } | null)?.error
      ?.description ??
    (error as Error | null)?.message ??
    "Unknown Razorpay error";

  return new PaymentError("RAZORPAY_API_ERROR", description, error);
}
