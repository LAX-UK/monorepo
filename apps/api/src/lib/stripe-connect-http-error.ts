import type { ContentfulStatusCode } from "hono/utils/http-status";
import Stripe from "stripe";

export type StripeConnectHttpError = {
  status: ContentfulStatusCode;
  body: { error: string; stripe_code?: string };
  recordAccountCreateFailure?: boolean;
};

function isPlatformProfileIncomplete(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("platform-profile") || lower.includes("managing losses");
}

/** Maps Stripe SDK errors from Connect routes to stable API error codes. */
export function stripeConnectErrorToHttp(err: unknown): StripeConnectHttpError | null {
  if (!(err instanceof Stripe.errors.StripeError)) {
    return null;
  }

  if (isPlatformProfileIncomplete(err.message)) {
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
