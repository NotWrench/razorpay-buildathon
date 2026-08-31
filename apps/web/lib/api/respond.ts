import { PaymentError } from "@workspace/payments";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data, success: true }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown
): Response {
  return Response.json(
    { error: { code, details, message }, success: false },
    { status }
  );
}

export function unauthorized(): Response {
  return fail(
    "UNAUTHORIZED",
    "A signed-in session or a valid x-api-key header is required",
    401
  );
}

/** Maps domain and validation errors onto stable HTTP responses. */
export function handleRouteError(error: unknown): Response {
  if (error instanceof ZodError) {
    return fail(
      "INVALID_REQUEST",
      "Request body failed validation",
      422,
      error.issues
    );
  }

  if (error instanceof PaymentError) {
    return fail(error.code, error.message, error.status, error.details);
  }

  console.error("Unhandled payments route error", error);

  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}
