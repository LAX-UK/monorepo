import type Stripe from "stripe";
import type { IStripeClientFactory } from "../stripe/stripe-client-factory.js";
import { executeWithStripeRetries } from "../stripe/stripe-retries.js";
import type { IPaymentProviderCloser, ProviderMoneyState } from "./provider-money-state.js";

/** Intents that can still be cancelled because no money has started moving. */
const CANCELLABLE: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

/** A UK bank transfer that has received part of the money: it must never be cancelled. */
function isPartFunded(pi: Stripe.PaymentIntent): boolean {
  const remaining = pi.next_action?.display_bank_transfer_instructions?.amount_remaining;
  return typeof remaining === "number" && remaining < pi.amount;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Closes everything Stripe holds open for one invoice and reports its money, re-reading each
 * object after closing it: a checkout or intent can complete between our read and our close.
 */
export class StripeCheckoutCloser implements IPaymentProviderCloser {
  constructor(
    private readonly stripeFactory: IStripeClientFactory,
    /** True where payments are taken (production): there, no Stripe client means "unknown". */
    private readonly options: { stripeExpected: boolean } = { stripeExpected: true },
  ) {}

  async closeAndRead(input: {
    paymentId: string;
    paymentIntentId: string | null;
    checkoutSessionIds: readonly string[];
  }): Promise<ProviderMoneyState> {
    const stripe = this.stripeFactory.get();
    if (!stripe) {
      // Without Stripe nothing can be checked. Only a deployment that takes no payments (local,
      // test) may expire an invoice that never reached Stripe; anywhere else it waits.
      return !this.options.stripeExpected &&
        !input.paymentIntentId &&
        input.checkoutSessionIds.length === 0
        ? { kind: "no_money" }
        : { kind: "unknown", error: "stripe_not_configured" };
    }
    try {
      const intentIds = new Set<string>(input.paymentIntentId ? [input.paymentIntentId] : []);
      for (const sessionId of input.checkoutSessionIds) {
        const session = await this.closeSession(stripe, sessionId);
        if (session.status === "open") {
          return { kind: "unknown", error: "checkout_session_still_open" };
        }
        const intentId = idOf(session.payment_intent);
        if (intentId) intentIds.add(intentId);
      }
      // Intents created by checkouts opened before sessions were recorded.
      const found = await executeWithStripeRetries(() =>
        stripe.paymentIntents.search({
          query: `metadata['paymentId']:'${input.paymentId}'`,
          limit: 20,
        }),
      );
      for (const pi of found.data) intentIds.add(pi.id);

      let inFlight: ProviderMoneyState | null = null;
      for (const intentId of intentIds) {
        const pi = await this.closeIntent(stripe, intentId);
        if (pi.status === "succeeded") {
          return {
            kind: "paid",
            paymentIntentId: pi.id,
            chargeId: idOf(pi.latest_charge),
            amountReceivedPence: pi.amount_received,
          };
        }
        if (pi.status === "processing") {
          inFlight = { kind: "in_flight", paymentIntentId: pi.id, reason: "processing" };
        } else if (isPartFunded(pi)) {
          inFlight = { kind: "in_flight", paymentIntentId: pi.id, reason: "transfer_part_funded" };
        } else if (pi.status !== "canceled") {
          return { kind: "unknown", error: `payment_intent_${pi.status}` };
        }
      }
      return inFlight ?? { kind: "no_money" };
    } catch (err) {
      return { kind: "unknown", error: message(err) };
    }
  }

  private async closeSession(stripe: Stripe, sessionId: string) {
    const session = await executeWithStripeRetries(() =>
      stripe.checkout.sessions.retrieve(sessionId),
    );
    if (session.status !== "open") return session;
    try {
      return await executeWithStripeRetries(() => stripe.checkout.sessions.expire(sessionId));
    } catch {
      // It completed (or expired) while we were closing it: read what it became.
      return executeWithStripeRetries(() => stripe.checkout.sessions.retrieve(sessionId));
    }
  }

  private async closeIntent(stripe: Stripe, intentId: string): Promise<Stripe.PaymentIntent> {
    const pi = await executeWithStripeRetries(() => stripe.paymentIntents.retrieve(intentId));
    if (!CANCELLABLE.has(pi.status) || isPartFunded(pi)) return pi;
    try {
      return await executeWithStripeRetries(() =>
        stripe.paymentIntents.cancel(intentId, {}, { idempotencyKey: `cancel:${intentId}` }),
      );
    } catch {
      return executeWithStripeRetries(() => stripe.paymentIntents.retrieve(intentId));
    }
  }
}
