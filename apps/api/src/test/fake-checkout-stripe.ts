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
  /** Stripe's payment_status: a bank transfer session is complete but unpaid until funds arrive. */
  paymentStatus: "paid" | "unpaid";
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
  /** Sessions the buyer completes while they are being closed. */
  readonly completeOnExpire = new Set<string>();
  readonly intents = new Map<
    string,
    { status: string; amount: number; received: number; remaining: number }
  >();
  readonly cancelledIntents: string[] = [];
  /** Intents whose cancel Stripe refuses as if funds had landed (`payment_intent_unexpected_state`). */
  readonly cancelRefusedFor = new Set<string>();
  failCancelFor = new Set<string>();
  private seq = 0;
  /** Session ids are `<prefix><n>`; a database-backed test sets a prefix unique to its run. */
  idPrefix = "cs_";

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
    const id = `${this.idPrefix}${this.seq}`;
    const result = { sessionId: id, url: `https://stripe/${id}`, paymentIntentId: null };
    this.sessions.set(id, {
      id,
      status: "open",
      paymentStatus: "unpaid",
      rail,
      paymentIntent: null,
    });
    this.byKey.set(idempotencyKey, { params: JSON.stringify(params), result });
    return result;
  }

  async expireCheckoutSession(id: string) {
    if (this.failExpireFor.has(id)) throw new Error("stripe unavailable");
    const s = this.sessions.get(id);
    if (!s) return null;
    // The buyer pays on the page between the caller's read and the expire: the gateway's own
    // read sees it complete and leaves it.
    if (this.completeOnExpire.has(id) && s.status === "open") {
      s.status = "complete";
      s.paymentStatus = "paid";
    }
    if (s.status !== "open") return s.status;
    s.status = "expired";
    // Stripe cancels the payment intent of the Checkout session it expires.
    const intent = s.paymentIntent ? this.intents.get(s.paymentIntent) : null;
    if (intent && intent.status !== "succeeded") intent.status = "canceled";
    return s.status;
  }

  async retrieveCheckoutSession(id: string) {
    const s = this.sessions.get(id);
    return {
      id,
      status: s?.status,
      payment_status: s?.paymentStatus,
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

  /**
   * The buyer chose bank transfer and was shown the instructions. Stripe completes the session
   * at that point, unpaid, and its payment intent waits in requires_action for the funds.
   */
  giveTransferInstructions(id: string, amount = 5000) {
    const s = this.sessions.get(id);
    if (!s) return;
    s.status = "complete";
    s.paymentStatus = "unpaid";
    s.paymentIntent = `pi_${id}`;
    this.intents.set(`pi_${id}`, {
      status: "requires_action",
      amount,
      received: 0,
      remaining: amount,
    });
  }

  /** Part of the transfer arrived: the intent keeps waiting for the rest. */
  partiallyFund(id: string, received: number) {
    const intent = this.intents.get(`pi_${id}`);
    if (!intent) return;
    // As Stripe reports it: the amount still to send falls; `amount_received` stays 0 until success.
    intent.remaining = intent.amount - received;
  }

  /** The buyer paid this session (the intent that paid is returned). */
  complete(id: string) {
    const s = this.sessions.get(id);
    if (!s) return null;
    s.status = "complete";
    s.paymentStatus = "paid";
    s.paymentIntent ??= `pi_${id}`;
    const intent = this.intents.get(s.paymentIntent);
    if (intent) {
      intent.status = "succeeded";
      intent.received = intent.amount;
      intent.remaining = 0;
    }
    return s.paymentIntent;
  }

  /** The whole transfer arrived: the session is paid and its intent succeeded. */
  fullyFund(id: string) {
    return this.complete(id);
  }

  /** The transfer landed and is being processed: the intent can no longer be cancelled. */
  markProcessing(id: string) {
    const intent = this.intents.get(`pi_${id}`);
    if (intent) intent.status = "processing";
  }

  async retrievePaymentIntent(id: string) {
    const i = this.intents.get(id);
    if (!i) throw new Error(`No such payment intent: ${id}`);
    return {
      id,
      status: i.status,
      amount: i.amount,
      amount_received: i.received,
      next_action:
        i && i.status === "requires_action"
          ? {
              display_bank_transfer_instructions: {
                amount_remaining: i.remaining,
                hosted_instructions_url: `https://stripe/instructions/${id}`,
              },
            }
          : null,
    } as unknown as Stripe.PaymentIntent;
  }

  async cancelPaymentIntent(id: string) {
    if (this.failCancelFor.has(id)) throw new Error("stripe unavailable");
    const i = this.intents.get(id);
    if (i?.status === "canceled") return;
    // Stripe refuses to cancel the intent of an open Checkout session: expire the session instead.
    const owner = [...this.sessions.values()].find((s) => s.paymentIntent === id);
    const refused =
      owner?.status === "open" ||
      this.cancelRefusedFor.has(id) ||
      (i && i.status !== "requires_action" && i.status !== "requires_payment_method");
    if (refused) {
      // The refusal is how a transfer that landed in the window shows itself.
      if (i && this.cancelRefusedFor.has(id)) i.status = "processing";
      throw Object.assign(new Error("payment_intent_unexpected_state"), {
        code: "payment_intent_unexpected_state",
      });
    }
    this.cancelledIntents.push(id);
    if (i) i.status = "canceled";
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
/** A fixture price per line name, so a changed list of lines is a changed amount. */
const linePriceCents = (name: string) =>
  [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 100;

export function payOn(
  lifecycle: CheckoutSessionLifecycle,
  stripe: FakeCheckoutStripe,
  rail: CheckoutSessionRail,
  lines: string[],
  /** How the invoice is shown (title, hero image URL): not part of the money asked for. */
  display: { title?: string; imageUrl?: string } = {},
) {
  const lineItems = lines.map((name) => ({
    name: display.title ? `${display.title}: ${name}` : name,
    unitAmountCents: linePriceCents(name),
    ...(display.imageUrl ? { images: [display.imageUrl] } : {}),
  }));
  const money = {
    paymentId: "pay-1",
    amountCents: lineItems.reduce((sum, line) => sum + line.unitAmountCents, 0),
    currency: "gbp",
    lineItems,
  };
  // As the real rails do: bank transfer also names the Stripe customer, card does not.
  const parameters = rail === "bank" ? { ...money, stripeCustomerId: "cus_fixture" } : money;
  return lifecycle.openOrRenew(rail, "pay-1", parameters, (idempotencyKey) =>
    rail === "card"
      ? stripe.createCardCheckoutSession({ ...parameters, idempotencyKey } as never)
      : stripe.createBankTransferCheckoutSession({ ...parameters, idempotencyKey } as never),
  );
}
