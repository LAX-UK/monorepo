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

/** How many expired sessions in a row a renewal may step over before giving up. */
const MAX_RENEWALS = 3;

/**
 * Creates a Checkout Session (idempotent on `paymentId`), then renews it when Stripe returns an
 * expired or unusable one. The renewal key is derived from the session it replaces, so two
 * requests renewing at once (two tabs, a double click) get the same new session, never two
 * payable ones.
 */
export async function createOrRenewCheckoutSession(
  gateway: IStripePaymentGateway,
  rail: CheckoutSessionRail,
  paymentId: string,
  create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
): Promise<RenewCheckoutSessionOutcome> {
  const baseKey = checkoutSessionIdempotencyKey(rail, paymentId);
  let key = baseKey;
  for (let attempt = 0; attempt <= MAX_RENEWALS; attempt += 1) {
    const created = await createWithKey(create, key);
    const stripeSession = await gateway.retrieveCheckoutSession(created.sessionId);
    if (stripeSession.status === "complete") return { kind: "already_complete" };
    if (isCheckoutSessionUsable(stripeSession)) return { kind: "ready", session: created };
    key = renewalIdempotencyKey(baseKey, created.sessionId);
  }
  return { kind: "unavailable", error: "Stripe checkout session is not open" };
}

/**
 * Stripe refuses a key reused with different parameters (a checkout's lines changed in a release,
 * within the key's 24 hours). That request is reissued under a key derived from the refused one,
 * the same for every caller, so it neither fails for a day nor opens two sessions.
 */
async function createWithKey(
  create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
  key: string,
): Promise<CreateCheckoutSessionResult> {
  try {
    return await create(key);
  } catch (err) {
    if (!isIdempotencyParameterMismatch(err)) throw err;
    return create(`${key}:reissued`);
  }
}

export function isIdempotencyParameterMismatch(err: unknown): boolean {
  const e = err as { type?: unknown; code?: unknown } | null;
  return e?.type === "StripeIdempotencyError" && e.code !== "idempotency_key_in_use";
}

/** The key for the session that replaces `expiredSessionId`: the same for every caller. */
export function renewalIdempotencyKey(baseKey: string, expiredSessionId: string): string {
  return `${baseKey}:renewed:${expiredSessionId}`;
}
