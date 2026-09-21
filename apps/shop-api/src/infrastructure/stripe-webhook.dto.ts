import type Stripe from "stripe";
import type {
  StripeCheckoutAsyncFailedDto,
  StripeCheckoutCompletedDto,
  StripeCheckoutExpiredDto,
} from "../application/ports/stripe-webhook.types.js";

export type { StripeCheckoutAsyncFailedDto, StripeCheckoutCompletedDto, StripeCheckoutExpiredDto };

const SHOP_CHECKOUT_APP = "shop";
const SHOP_CHECKOUT_CURRENCY = "gbp";

const CHECKOUT_SESSION_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

function readCheckoutSessionObject(event: Stripe.Event): Stripe.Checkout.Session | null {
  if (!CHECKOUT_SESSION_EVENT_TYPES.has(event.type)) {
    return null;
  }
  const session = event.data.object;
  if (!session || typeof session !== "object" || !("metadata" in session)) {
    return null;
  }
  return session as Stripe.Checkout.Session;
}

function isShopCheckoutSession(session: Stripe.Checkout.Session): boolean {
  const app = session.metadata?.app;
  if (app === SHOP_CHECKOUT_APP) {
    return true;
  }
  if (app && app !== SHOP_CHECKOUT_APP) {
    return false;
  }
  return Boolean(session.metadata?.orderId);
}

function customerEmailFromSession(session: Stripe.Checkout.Session): string | null {
  const details = session.customer_details;
  const email = details?.email?.trim();
  return email?.includes("@") ? email : null;
}

function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export function parseCheckoutSessionCompleted(
  event: Stripe.Event,
): StripeCheckoutCompletedDto | null {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return null;
  }
  const session = readCheckoutSessionObject(event);
  if (!session || !isShopCheckoutSession(session)) return null;
  if (!isPaidCheckoutSession(session)) return null;
  if (session.currency && session.currency !== SHOP_CHECKOUT_CURRENCY) return null;
  const orderId = session.metadata?.orderId;
  const amountTotal = session.amount_total;
  if (!orderId || amountTotal === null || amountTotal === undefined) return null;
  return {
    eventId: event.id,
    paidAt: new Date(event.created * 1000),
    orderId,
    amountTotalPence: amountTotal,
    customerEmail: customerEmailFromSession(session),
  };
}

export function parseCheckoutSessionExpired(event: Stripe.Event): StripeCheckoutExpiredDto | null {
  if (event.type !== "checkout.session.expired") return null;
  const session = readCheckoutSessionObject(event);
  if (!session || !isShopCheckoutSession(session)) return null;
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  return { eventId: event.id, orderId };
}

export function parseCheckoutSessionAsyncPaymentFailed(
  event: Stripe.Event,
): StripeCheckoutAsyncFailedDto | null {
  if (event.type !== "checkout.session.async_payment_failed") return null;
  const session = readCheckoutSessionObject(event);
  if (!session || !isShopCheckoutSession(session)) return null;
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  return { eventId: event.id, orderId };
}
