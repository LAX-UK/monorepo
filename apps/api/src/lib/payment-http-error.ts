import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AuthzError, PaymentProviderError } from "./errors.js";
import { asHttpStatus } from "./http-status.js";

export type PaymentCommandHttpError =
  | {
      kind: "json";
      status: ContentfulStatusCode;
      body: { error: string; stripe_code: string | null };
    }
  | { kind: "json"; status: ContentfulStatusCode; body: { error: string } };

/** Maps provider / authz errors from capture & refund routes (no business rules). */
export function paymentCommandErrorToHttp(
  error: AuthzError | PaymentProviderError,
): PaymentCommandHttpError {
  if (error instanceof PaymentProviderError) {
    return {
      kind: "json",
      status: error.status as ContentfulStatusCode,
      body: { error: error.message, stripe_code: error.stripeCode ?? null },
    };
  }
  if (error instanceof AuthzError) {
    return {
      kind: "json",
      status: asHttpStatus(error.status),
      body: { error: error.message },
    };
  }
  throw error;
}
