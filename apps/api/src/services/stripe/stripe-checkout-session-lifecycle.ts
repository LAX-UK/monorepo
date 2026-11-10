import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type {
  CreateCheckoutSessionResult,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

export type CheckoutSessionRail = "card" | "bank";

/**
 * A short, stable fingerprint of a checkout's parameters. It is part of the idempotency key, so
 * one key always means one set of parameters: Stripe replays the session for the same parameters
 * and a changed invoice (new lines, delivery) gets a key, and a session, of its own.
 */
export function checkoutParametersFingerprint(parameters: object): string {
  return createHash("sha256").update(JSON.stringify(parameters)).digest("hex").slice(0, 16);
}

export function checkoutSessionIdempotencyKey(
  rail: CheckoutSessionRail,
  paymentId: string,
  parameters: object,
): string {
  return `checkout:${rail}:payment:${paymentId}:p:${checkoutParametersFingerprint(parameters)}`;
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

/** How many expired sessions in a row a renewal may step over before giving up. */
const MAX_RENEWALS = 3;

/**
 * Creates a Checkout Session (idempotent on the payment and its parameters), then renews it when Stripe returns an
 * expired or unusable one. The renewal key is derived from the session it replaces, so two
 * requests renewing at once (two tabs, a double click) get the same new session, never two
 * payable ones.
 */
export async function createOrRenewCheckoutSession(
  gateway: IStripePaymentGateway,
  rail: CheckoutSessionRail,
  paymentId: string,
  parameters: object,
  create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
): Promise<RenewCheckoutSessionOutcome> {
  const baseKey = checkoutSessionIdempotencyKey(rail, paymentId, parameters);
  let key = baseKey;
  for (let attempt = 0; attempt <= MAX_RENEWALS; attempt += 1) {
    const created = await create(key);
    const stripeSession = await gateway.retrieveCheckoutSession(created.sessionId);
    if (stripeSession.status === "complete") return { kind: "already_complete" };
    if (isCheckoutSessionUsable(stripeSession)) return { kind: "ready", session: created };
    key = renewalIdempotencyKey(baseKey, created.sessionId);
  }
  return { kind: "unavailable", error: "Stripe checkout session is not open" };
}

/** The key for the session that replaces `expiredSessionId`: the same for every caller. */
export function renewalIdempotencyKey(baseKey: string, expiredSessionId: string): string {
  return `${baseKey}:renewed:${expiredSessionId}`;
}
