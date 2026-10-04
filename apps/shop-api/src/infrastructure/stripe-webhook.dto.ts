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
  return session.metadata?.app === SHOP_CHECKOUT_APP && Boolean(session.metadata?.orderId?.trim());
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
  if (session.currency !== SHOP_CHECKOUT_CURRENCY) return null;
  const orderId = session.metadata?.orderId;
  const amountTotal = session.amount_total;
  if (!orderId || amountTotal === null || amountTotal === undefined) return null;
  return {
    eventId: event.id,
    paidAt: new Date(event.created * 1000),
    orderId,
    sessionId: session.id,
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
  return { eventId: event.id, orderId, sessionId: session.id };
}

/** Shop checkout paid in a non-GBP currency (must fail closed, not ignore). */
export function parseShopCheckoutCurrencyViolation(event: Stripe.Event): {
  eventId: string;
  orderId: string;
  currency: string;
  sessionId: string;
} | null {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return null;
  }
  const session = readCheckoutSessionObject(event);
  if (!session || !isShopCheckoutSession(session) || !isPaidCheckoutSession(session)) {
    return null;
  }
  if (session.currency === SHOP_CHECKOUT_CURRENCY) {
    return null;
  }
  const orderId = session.metadata?.orderId?.trim();
  if (!orderId) return null;
  return {
    eventId: event.id,
    orderId,
    currency: session.currency ?? "unknown",
    sessionId: session.id,
  };
}

export function parseCheckoutSessionAsyncPaymentFailed(
  event: Stripe.Event,
): StripeCheckoutAsyncFailedDto | null {
  if (event.type !== "checkout.session.async_payment_failed") return null;
  const session = readCheckoutSessionObject(event);
  if (!session || !isShopCheckoutSession(session)) return null;
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  return { eventId: event.id, orderId, sessionId: session.id };
}

const SHOP_APP_METADATA = "shop";

function paymentIntentIdFromCharge(charge: Stripe.Charge): string | null {
  const pi = charge.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) {
    return typeof pi.id === "string" ? pi.id : null;
  }
  return null;
}

function mapRefundStatus(
  status: Stripe.Refund["status"],
): "succeeded" | "failed" | "pending" | "cancelled" {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "canceled") return "cancelled";
  return "pending";
}

export function parseChargeRefunded(event: Stripe.Event): {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
} | null {
  if (event.type !== "charge.refunded") return null;
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = paymentIntentIdFromCharge(charge);
  if (!paymentIntentId) return null;
  const refunds = charge.refunds?.data ?? [];
  const latest = refunds[refunds.length - 1];
  if (!latest?.id) return null;
  return {
    eventId: event.id,
    stripeRefundId: latest.id,
    paymentIntentId,
    amountPence: latest.amount ?? charge.amount_refunded ?? 0,
    status: mapRefundStatus(latest.status ?? "succeeded"),
  };
}

export function parseRefundUpdated(event: Stripe.Event): {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
  shopRefundId?: string;
} | null {
  if (event.type !== "refund.updated") return null;
  return parseStripeRefundObject(event.id, event.data.object as Stripe.Refund);
}

export function parseStripeRefundEvent(event: Stripe.Event): {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
  shopRefundId?: string;
  source: "refund.created" | "refund.updated" | "refund.failed";
} | null {
  if (
    event.type !== "refund.created" &&
    event.type !== "refund.updated" &&
    event.type !== "refund.failed"
  ) {
    return null;
  }
  const parsed = parseStripeRefundObject(event.id, event.data.object as Stripe.Refund);
  if (!parsed) return null;
  return {
    ...parsed,
    source: event.type,
  };
}

function parseStripeRefundObject(
  eventId: string,
  refund: Stripe.Refund,
): {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
  shopRefundId?: string;
} | null {
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : (refund.payment_intent?.id ?? null);
  if (!refund.id || !paymentIntentId) return null;
  const shopRefundId = refund.metadata?.shop_refund_id?.trim() || undefined;
  return {
    eventId,
    stripeRefundId: refund.id,
    paymentIntentId,
    amountPence: refund.amount ?? 0,
    status: mapRefundStatus(refund.status ?? "pending"),
    ...(shopRefundId ? { shopRefundId } : {}),
  };
}

export function parseDisputeEvent(event: Stripe.Event): {
  eventId: string;
  stripeDisputeId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "opened" | "closed";
  outcome?: "won" | "lost";
} | null {
  if (
    event.type !== "charge.dispute.created" &&
    event.type !== "charge.dispute.updated" &&
    event.type !== "charge.dispute.closed"
  ) {
    return null;
  }
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? null);
  if (!dispute.id || !paymentIntentId) return null;
  const closed =
    event.type === "charge.dispute.closed" || dispute.status === "lost" || dispute.status === "won";
  let outcome: "won" | "lost" | undefined;
  if (dispute.status === "won") outcome = "won";
  if (dispute.status === "lost") outcome = "lost";
  return {
    eventId: event.id,
    stripeDisputeId: dispute.id,
    paymentIntentId,
    amountPence: dispute.amount,
    status: closed ? "closed" : "opened",
    ...(outcome ? { outcome } : {}),
  };
}

export function isShopOwnedPaymentIntentMetadata(
  metadata: Stripe.Metadata | null | undefined,
): boolean {
  return metadata?.app === SHOP_APP_METADATA;
}
