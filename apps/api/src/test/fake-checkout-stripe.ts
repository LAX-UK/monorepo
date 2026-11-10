import type { IPaymentCheckoutSessionStore } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type {
  CheckoutSessionLifecycle,
  CheckoutSessionRail,
} from "../services/stripe/stripe-checkout-session-lifecycle.js";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
} from "../services/stripe/stripe-payment-gateway.js";

type FakeSession = {
  id: string;
  status: "open" | "expired" | "complete";
  rail: CheckoutSessionRail;
  paymentIntent: string | null;
};

/**
 * Stripe's Checkout rules that matter here: a key replays its first response, even after that
 * session closed, and is refused for different parameters.
 */
export class FakeCheckoutStripe {
  readonly sessions = new Map<string, FakeSession>();
  private readonly byKey = new Map<
    string,
    { params: string; result: CreateCheckoutSessionResult }
  >();
  readonly keys: string[] = [];
  failExpireFor = new Set<string>();
  private seq = 0;

  createCardCheckoutSession = (input: CreateCheckoutSessionInput) => this.create("card", input);
  createBankTransferCheckoutSession = (input: CreateCheckoutSessionInput) =>
    this.create("bank", input);

  private async create(rail: CheckoutSessionRail, input: CreateCheckoutSessionInput) {
    const { idempotencyKey = "", ...params } = input;
    this.keys.push(idempotencyKey);
    const seen = this.byKey.get(idempotencyKey);
    if (seen) {
      if (seen.params !== JSON.stringify(params)) {
        throw Object.assign(new Error("same key, different parameters"), {
          type: "StripeIdempotencyError",
        });
      }
      return seen.result;
    }
    this.seq += 1;
    const id = `cs_${this.seq}`;
    const result = { sessionId: id, url: `https://stripe/${id}`, paymentIntentId: null };
    this.sessions.set(id, { id, status: "open", rail, paymentIntent: null });
    this.byKey.set(idempotencyKey, { params: JSON.stringify(params), result });
    return result;
  }

  async expireCheckoutSession(id: string) {
    if (this.failExpireFor.has(id)) throw new Error("stripe unavailable");
    const s = this.sessions.get(id);
    if (s?.status === "open") s.status = "expired";
  }

  async retrieveCheckoutSession(id: string) {
    const s = this.sessions.get(id);
    return {
      id,
      status: s?.status,
      url: `https://stripe/${id}`,
      payment_intent: s?.paymentIntent ?? null,
      payment_method_types: s?.rail === "bank" ? ["customer_balance"] : ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    } as Stripe.Checkout.Session;
  }

  /** Closed at Stripe outside this app (a manual-review hold, a timeout). */
  closeExternally(id: string) {
    const s = this.sessions.get(id);
    if (s) s.status = "expired";
  }

  /** The buyer was given bank transfer instructions: the session now has a payment intent. */
  giveTransferInstructions(id: string) {
    const s = this.sessions.get(id);
    if (s) s.paymentIntent = `pi_${id}`;
  }

  open(rail?: CheckoutSessionRail) {
    return [...this.sessions.values()]
      .filter((s) => s.status === "open" && (!rail || s.rail === rail))
      .map((s) => s.id);
  }
}

export class InMemoryCheckoutSessionLedger
  implements Pick<IPaymentCheckoutSessionStore, "record" | "listSessions" | "markClosed">
{
  private readonly rows: Awaited<ReturnType<IPaymentCheckoutSessionStore["listSessions"]>> = [];
  private readonly payments = new Map<string, string>();

  async record(
    paymentId: string,
    stripeSessionId: string,
    detail?: { rail: CheckoutSessionRail; parametersFingerprint: string },
  ) {
    if (this.rows.some((r) => r.stripeSessionId === stripeSessionId)) return;
    this.payments.set(stripeSessionId, paymentId);
    this.rows.push({
      stripeSessionId,
      rail: detail?.rail ?? null,
      parametersFingerprint: detail?.parametersFingerprint ?? null,
      closedAt: null,
    });
  }

  async listSessions(paymentId: string) {
    return this.rows
      .filter((r) => this.payments.get(r.stripeSessionId) === paymentId)
      .map((r) => ({ ...r }));
  }

  async markClosed(stripeSessionId: string) {
    const row = this.rows.find((r) => r.stripeSessionId === stripeSessionId);
    if (row && !row.closedAt) row.closedAt = new Date();
  }
}

/** Pay on an invoice the way the rails do: the parameters are the checkout's own content. */
export function payOn(
  lifecycle: CheckoutSessionLifecycle,
  stripe: FakeCheckoutStripe,
  rail: CheckoutSessionRail,
  lines: string[],
) {
  const parameters = { paymentId: "pay-1", lines };
  return lifecycle.openOrRenew(rail, "pay-1", parameters, (idempotencyKey) =>
    rail === "card"
      ? stripe.createCardCheckoutSession({ ...parameters, idempotencyKey } as never)
      : stripe.createBankTransferCheckoutSession({ ...parameters, idempotencyKey } as never),
  );
}
