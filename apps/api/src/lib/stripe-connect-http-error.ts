import type { ContentfulStatusCode } from "hono/utils/http-status";
import Stripe from "stripe";

export type StripeConnectHttpError = {
  status: ContentfulStatusCode;
  body: { error: string; stripe_code?: string };
  recordAccountCreateFailure?: boolean;
};

export function isPlatformProfileStripeMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("platform-profile") || lower.includes("managing losses");
}

type StripeErrorLike = { message: string; type?: string; code?: string };

function isStripeErrorLike(err: unknown): err is StripeErrorLike {
  if (err instanceof Stripe.errors.StripeError) return true;
  if (!err || typeof err !== "object") return false;
  const candidate = err as { type?: unknown; message?: unknown };
  return (
    typeof candidate.message === "string" &&
    typeof candidate.type === "string" &&
    candidate.type.endsWith("_error")
  );
}

/** Maps Stripe SDK errors from Connect routes to stable API error codes. */
export function stripeConnectErrorToHttp(err: unknown): StripeConnectHttpError | null {
  if (!isStripeErrorLike(err)) {
    return null;
  }

  if (isPlatformProfileStripeMessage(err.message)) {
    return {
      status: 503,
      body: {
        error: "stripe_platform_profile_incomplete",
        ...(err.code ? { stripe_code: err.code } : {}),
      },
      recordAccountCreateFailure: true,
    };
  }

  if (err.type === "StripeInvalidRequestError" || err.type === "StripeCardError") {
    return {
      status: 400,
      body: {
        error: "stripe_invalid_request",
        ...(err.code ? { stripe_code: err.code } : {}),
      },
      recordAccountCreateFailure: true,
    };
  }

  if (err.type === "StripeRateLimitError") {
    return {
      status: 429,
      body: { error: "stripe_rate_limited" },
    };
  }

  if (err.type === "StripeConnectionError" || err.type === "StripeAPIError") {
    return {
      status: 502,
      body: { error: "stripe_upstream_error" },
      recordAccountCreateFailure: true,
    };
  }

  return {
    status: 502,
    body: {
      error: "stripe_upstream_error",
      ...(err.code ? { stripe_code: err.code } : {}),
    },
    recordAccountCreateFailure: true,
  };
}
