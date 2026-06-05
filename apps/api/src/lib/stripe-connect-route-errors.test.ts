import { Hono } from "hono";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { ConnectServiceError } from "../services/stripe/connect/connect-service-errors.js";
import { respondStripeConnectRouteError } from "./stripe-connect-route-errors.js";

async function requestMappedError(err: unknown, path = "/") {
  const app = new Hono();
  app.get(path, (c) => {
    const res = respondStripeConnectRouteError(c, err);
    return res ?? c.json({ error: "unhandled" }, 500);
  });
  return app.request(path);
}

describe("respondStripeConnectRouteError", () => {
  it("maps domain errors to stable status codes", async () => {
    const cases: Array<{ err: Error; status: number; error: string; path: string }> = [
      {
        err: new Error("legal_entity_not_found"),
        status: 404,
        error: "legal_entity_not_found",
        path: "/not-found",
      },
      {
        err: new Error("stripe_account_missing"),
        status: 400,
        error: "stripe_account_missing",
        path: "/missing",
      },
      {
        err: new Error("insufficient_role"),
        status: 403,
        error: "insufficient_role",
        path: "/forbidden",
      },
      {
        err: new Error("connect_url_not_allowed"),
        status: 400,
        error: "connect_url_not_allowed",
        path: "/url",
      },
    ];

    for (const { err, status, error, path } of cases) {
      const res = await requestMappedError(err, path);
      expect(res.status).toBe(status);
      await expect(res.json()).resolves.toEqual({ error });
    }
  });

  it("does not expose ConnectServiceError meta to clients", async () => {
    const err = new ConnectServiceError("legal_entity_update_failed", 500, {
      stripeAccountId: "acct_secret",
    });
    const res = await requestMappedError(err, "/update-failed");
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "legal_entity_update_failed" });
  });

  it("maps Stripe platform profile errors to 503", async () => {
    const err = new Stripe.errors.StripeInvalidRequestError({
      message:
        "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
      type: "invalid_request_error",
    } as never);

    const res = await requestMappedError(err, "/platform");
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "stripe_platform_profile_incomplete",
    });
  });
});
