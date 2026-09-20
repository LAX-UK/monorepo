import type Stripe from "stripe";
import {
  parseCheckoutSessionAsyncPaymentFailed,
  parseCheckoutSessionCompleted,
  parseCheckoutSessionExpired,
} from "./stripe-webhook.dto.js";

export function parseVerifiedCheckoutSessionCompleted(event: unknown) {
  return parseCheckoutSessionCompleted(event as Stripe.Event);
}

export function parseVerifiedCheckoutSessionExpired(event: unknown) {
  return parseCheckoutSessionExpired(event as Stripe.Event);
}

export function parseVerifiedCheckoutSessionAsyncPaymentFailed(event: unknown) {
  return parseCheckoutSessionAsyncPaymentFailed(event as Stripe.Event);
}
