import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { stripeConnectErrorToHttp } from "./stripe-connect-http-error.js";

describe("stripeConnectErrorToHttp", () => {
  it("maps platform profile incomplete errors to 503", () => {
    const err = new Stripe.errors.StripeInvalidRequestError({
      message:
        "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
      type: "invalid_request_error",
    } as never);

    expect(stripeConnectErrorToHttp(err)).toEqual({
      status: 503,
      body: { error: "stripe_platform_profile_incomplete" },
      recordAccountCreateFailure: true,
    });
  });

  it("maps other invalid request errors to 400", () => {
    const err = new Stripe.errors.StripeInvalidRequestError({
      message: "bad country",
      type: "invalid_request_error",
      code: "account_invalid_country",
    } as never);

    expect(stripeConnectErrorToHttp(err)).toEqual({
      status: 400,
      body: { error: "stripe_invalid_request", stripe_code: "account_invalid_country" },
      recordAccountCreateFailure: true,
    });
  });

  it("maps connection errors to 502", () => {
    const err = new Stripe.errors.StripeConnectionError({
      message: "network",
      type: "connection_error",
    } as never);

    expect(stripeConnectErrorToHttp(err)).toEqual({
      status: 502,
      body: { error: "stripe_upstream_error" },
      recordAccountCreateFailure: true,
    });
  });

  it("returns null for non-Stripe errors", () => {
    expect(stripeConnectErrorToHttp(new Error("kyc_not_approved"))).toBeNull();
  });

  it("maps duck-typed Stripe invalid request objects", () => {
    expect(
      stripeConnectErrorToHttp({
        type: "invalid_request_error",
        message:
          "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
      }),
    ).toEqual({
      status: 503,
      body: { error: "stripe_platform_profile_incomplete" },
      recordAccountCreateFailure: true,
    });
  });
});
