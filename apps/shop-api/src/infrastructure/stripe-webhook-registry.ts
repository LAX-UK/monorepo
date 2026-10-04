import type Stripe from "stripe";
import type { StripeMoneyWebhookOutcome } from "../application/ports/stripe-money-webhook.types.js";
import {
  parseCheckoutSessionAsyncPaymentFailed,
  parseCheckoutSessionCompleted,
  parseCheckoutSessionExpired,
  parseShopCheckoutCurrencyViolation,
} from "./stripe-webhook.dto.js";

export type StripeCheckoutWebhookHandlers = {
  completeCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  }): Promise<"processed" | "duplicate" | "terminal_acknowledged">;
  expireCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  failCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  recordCurrencyViolation(input: {
    eventId: string;
    orderId: string;
    currency: string;
    sessionId: string;
  }): Promise<"processed" | "duplicate">;
};

export type StripeWebhookDispatchResult =
  | { kind: "checkout"; outcome: string }
  | { kind: "money"; outcome: StripeMoneyWebhookOutcome }
  | { kind: "ignored" };

export async function dispatchStripeWebhookEvent(
  event: Stripe.Event,
  handlers: {
    checkout: StripeCheckoutWebhookHandlers;
    money: { processMoneyWebhook(event: Stripe.Event): Promise<StripeMoneyWebhookOutcome> };
  },
): Promise<StripeWebhookDispatchResult> {
  const currencyViolation = parseShopCheckoutCurrencyViolation(event);
  if (currencyViolation) {
    const outcome = await handlers.checkout.recordCurrencyViolation(currencyViolation);
    return { kind: "checkout", outcome };
  }

  const completed = parseCheckoutSessionCompleted(event);
  if (completed) {
    const outcome = await handlers.checkout.completeCheckout({
      eventId: completed.eventId,
      orderId: completed.orderId,
      sessionId: completed.sessionId,
      amountTotalPence: completed.amountTotalPence,
      paidAt: completed.paidAt,
      customerEmail: completed.customerEmail ?? null,
    });
    return { kind: "checkout", outcome };
  }

  const asyncFailed = parseCheckoutSessionAsyncPaymentFailed(event);
  if (asyncFailed) {
    const outcome = await handlers.checkout.failCheckout({
      eventId: asyncFailed.eventId,
      orderId: asyncFailed.orderId,
      sessionId: asyncFailed.sessionId,
    });
    return { kind: "checkout", outcome };
  }

  const expired = parseCheckoutSessionExpired(event);
  if (expired) {
    const outcome = await handlers.checkout.expireCheckout({
      eventId: expired.eventId,
      orderId: expired.orderId,
      sessionId: expired.sessionId,
    });
    return { kind: "checkout", outcome };
  }

  const moneyOutcome = await handlers.money.processMoneyWebhook(event);
  if (moneyOutcome !== "not_applicable") {
    return { kind: "money", outcome: moneyOutcome };
  }

  return { kind: "ignored" };
}
