import type Stripe from "stripe";
import type {
  CreateCheckoutSessionResult,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

export type CheckoutSessionRail = "card" | "bank";

export function checkoutSessionIdempotencyKey(
  rail: CheckoutSessionRail,
  paymentId: string,
): string {
  return rail === "card"
    ? `checkout:card:payment:${paymentId}`
    : `checkout:bank:payment:${paymentId}`;
}

/** True when the buyer can still complete payment on this hosted Checkout page. */
export function isCheckoutSessionUsable(session: Stripe.Checkout.Session): boolean {
  if (session.status === "complete") return false;
  if (session.status === "expired") return false;
  if (session.status === "open") {
    if (session.expires_at != null && session.expires_at * 1000 <= Date.now()) return false;
    return Boolean(session.url);
  }
  return false;
}

export type RenewCheckoutSessionOutcome =
  | { kind: "ready"; session: CreateCheckoutSessionResult }
  | { kind: "already_complete" }
  | { kind: "unavailable"; error: string };

/**
 * Creates a Checkout Session (idempotent on `paymentId`), then renews with a fresh
 * idempotency key when Stripe returns an expired or unusable session.
 */
export async function createOrRenewCheckoutSession(
  gateway: IStripePaymentGateway,
  rail: CheckoutSessionRail,
  paymentId: string,
  create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
): Promise<RenewCheckoutSessionOutcome> {
  const baseKey = checkoutSessionIdempotencyKey(rail, paymentId);
  let created = await create(baseKey);
  let stripeSession = await gateway.retrieveCheckoutSession(created.sessionId);

  if (stripeSession.status === "complete") {
    return { kind: "already_complete" };
  }

  if (isCheckoutSessionUsable(stripeSession)) {
    return { kind: "ready", session: created };
  }

  const renewKey = `${baseKey}:renewed:${Date.now()}`;
  created = await create(renewKey);
  stripeSession = await gateway.retrieveCheckoutSession(created.sessionId);

  if (stripeSession.status === "complete") {
    return { kind: "already_complete" };
  }

  if (!isCheckoutSessionUsable(stripeSession)) {
    return { kind: "unavailable", error: "Stripe checkout session is not open" };
  }

  return { kind: "ready", session: created };
}
