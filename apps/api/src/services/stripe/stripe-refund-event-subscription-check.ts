import type { IStripeClientFactory } from "../../lib/stripe-client.js";

/** The event that reports a refund changed status. */
export const REFUND_UPDATED_EVENT = "charge.refund.updated";
/** Where this API receives Stripe's payment events (see `routes/webhooks/stripe.ts`). */
export const PAYMENTS_WEBHOOK_PATH = "/webhooks/stripe/payments";

export type RefundEventSubscription =
  | { status: "not_configured" }
  | { status: "subscribed"; endpointIds: string[] }
  | { status: "missing"; endpointIds: string[] }
  | { status: "no_matching_endpoint" }
  | { status: "unreadable"; error: string };

/**
 * Whether the Stripe endpoint(s) sending this API its payment events receive
 * `charge.refund.updated`. It is read with the existing secret key; a key that may not read
 * webhook endpoints (a restricted key) answers `unreadable`. Nothing depends on the answer:
 * refunds that finish later are settled by the refund reconcile job either way, and the event
 * only makes that sooner.
 */
export async function checkRefundEventSubscription(
  stripeFactory: IStripeClientFactory,
  path = PAYMENTS_WEBHOOK_PATH,
): Promise<RefundEventSubscription> {
  const stripe = stripeFactory.get();
  if (!stripe) return { status: "not_configured" };
  try {
    const matching: { id: string; events: string[] }[] = [];
    for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
      if (endpoint.status !== "enabled") continue;
      let pathname: string;
      try {
        pathname = new URL(endpoint.url).pathname.replace(/\/+$/, "");
      } catch {
        continue;
      }
      if (!pathname.endsWith(path)) continue;
      matching.push({ id: endpoint.id, events: endpoint.enabled_events ?? [] });
    }
    if (matching.length === 0) return { status: "no_matching_endpoint" };
    const missing = matching.filter(
      (e) => !e.events.includes("*") && !e.events.includes(REFUND_UPDATED_EVENT),
    );
    return missing.length > 0
      ? { status: "missing", endpointIds: missing.map((e) => e.id) }
      : { status: "subscribed", endpointIds: matching.map((e) => e.id) };
  } catch (err) {
    return { status: "unreadable", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Logs, once at startup, what `checkRefundEventSubscription` found. A warning, never a failure:
 * the API starts and refunds are settled by the reconcile job whatever the endpoint receives.
 */
export async function logRefundEventSubscription(
  stripeFactory: IStripeClientFactory,
  log: Pick<Console, "info" | "warn">,
): Promise<RefundEventSubscription> {
  const result = await checkRefundEventSubscription(stripeFactory);
  switch (result.status) {
    case "missing":
      log.warn(
        JSON.stringify({
          msg: "stripe_webhook_missing_charge_refund_updated",
          endpointIds: result.endpointIds,
          effect:
            "Refunds that finish after they are made are settled by the stripe-refund-reconcile job (every 15 minutes, with backoff) instead of at once.",
        }),
      );
      break;
    case "no_matching_endpoint":
      log.warn(
        JSON.stringify({
          msg: "stripe_webhook_payments_endpoint_not_found",
          path: PAYMENTS_WEBHOOK_PATH,
          effect:
            "Could not confirm charge.refund.updated; the stripe-refund-reconcile job settles refunds either way.",
        }),
      );
      break;
    case "unreadable":
      log.info(
        JSON.stringify({ msg: "stripe_webhook_subscription_unreadable", error: result.error }),
      );
      break;
    case "subscribed":
      log.info(
        JSON.stringify({
          msg: "stripe_webhook_charge_refund_updated_subscribed",
          endpointIds: result.endpointIds,
        }),
      );
      break;
    case "not_configured":
      break;
  }
  return result;
}
