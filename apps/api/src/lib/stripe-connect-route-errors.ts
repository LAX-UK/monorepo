import type { Context } from "hono";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import { StripeConnectNotConfiguredError } from "../services/interfaces/stripe-connect.js";
import { ConnectServiceError } from "../services/stripe/connect/connect-service-errors.js";
import { stripeConnectErrorToHttp } from "./stripe-connect-http-error.js";

type RouteErrorOptions = {
  recordAccountCreateFailure?: boolean;
};

/** Maps Connect route failures to stable HTTP responses; returns null to rethrow. */
export function respondStripeConnectRouteError(
  c: Context,
  err: unknown,
  opts?: RouteErrorOptions,
): Response | null {
  if (err instanceof StripeConnectNotConfiguredError) {
    return c.json({ error: "stripe_not_configured" }, 503);
  }

  if (err instanceof ConnectServiceError) {
    return c.json({ error: err.code, ...err.meta }, err.httpStatus as 400);
  }

  if (err instanceof Error) {
    const msg = err.message;
    if (msg === "legal_entity_not_found") return c.json({ error: msg }, 404);
    if (msg === "insufficient_role" || msg === "kyc_not_approved") {
      return c.json({ error: msg }, 403);
    }
    if (msg === "stripe_account_missing") return c.json({ error: msg }, 400);
    if (msg === "account_session_missing_client_secret") {
      return c.json({ error: msg }, 502);
    }
    if (msg === "legal_entity_update_failed") return c.json({ error: msg }, 500);
    if (msg.startsWith("connect_url_")) return c.json({ error: msg }, 400);
  }

  const stripeMapped = stripeConnectErrorToHttp(err);
  if (!stripeMapped) return null;

  if (stripeMapped.recordAccountCreateFailure && opts?.recordAccountCreateFailure) {
    recordMoneyPathEvent("stripe_connect_account_create_failed");
  }

  return c.json(stripeMapped.body, stripeMapped.status);
}
