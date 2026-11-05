import { createHash } from "node:crypto";
import type { IPaymentCheckoutSessionStore } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type {
  CreateBankTransferCheckoutSessionInput,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  IStripePaymentGateway,
  StripeRefundInput,
} from "./stripe-payment-gateway.js";

/**
 * Records every Checkout session opened for an invoice before its link reaches the buyer. A
 * session has no payment intent until the buyer confirms, so without this record the expiry job
 * could not find an open session to close, and money could still arrive after cancelling.
 */
export class SessionRecordingStripeGateway implements IStripePaymentGateway {
  constructor(
    private readonly inner: IStripePaymentGateway,
    private readonly sessions: Pick<IPaymentCheckoutSessionStore, "record" | "listSessionIds">,
  ) {}

  isConfigured() {
    return this.inner.isConfigured();
  }

  createCardCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    return this.createRecorded(input, (i) => this.inner.createCardCheckoutSession(i));
  }

  createBankTransferCheckoutSession(
    input: CreateBankTransferCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    return this.createRecorded(input, (i) => this.inner.createBankTransferCheckoutSession(i));
  }

  /**
   * Opens the session and records it before its link is returned. If Stripe refuses the key
   * because the checkout's parameters changed (a release changed its lines within the key's 24
   * hours), every session already opened for the invoice is closed first, so only one can ever
   * be paid, and the session is opened under a key derived from the new parameters.
   */
  private async createRecorded<T extends CreateCheckoutSessionInput>(
    input: T,
    create: (input: T) => Promise<CreateCheckoutSessionResult>,
  ): Promise<CreateCheckoutSessionResult> {
    let created: CreateCheckoutSessionResult;
    try {
      created = await create(input);
    } catch (err) {
      if (!isIdempotencyParameterMismatch(err)) throw err;
      for (const sessionId of await this.sessions.listSessionIds(input.paymentId)) {
        await this.inner.expireCheckoutSession(sessionId);
      }
      created = await create({
        ...input,
        idempotencyKey: `${input.idempotencyKey ?? input.paymentId}:p:${parametersFingerprint(input)}`,
      });
    }
    await this.sessions.record(input.paymentId, created.sessionId);
    return created;
  }

  retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.inner.retrievePaymentIntent(paymentIntentId);
  }

  expireCheckoutSession(sessionId: string): Promise<void> {
    return this.inner.expireCheckoutSession(sessionId);
  }

  retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.inner.retrieveCheckoutSession(sessionId);
  }

  findChargeIdForPayment(paymentId: string) {
    return this.inner.findChargeIdForPayment(paymentId);
  }

  revokeOpenCheckoutForPayment(paymentId: string, paymentIntentId: string | null | undefined) {
    return this.inner.revokeOpenCheckoutForPayment(paymentId, paymentIntentId);
  }

  capturePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.inner.capturePaymentIntent(paymentIntentId);
  }

  createRefund(input: StripeRefundInput) {
    return this.inner.createRefund(input);
  }
}

/** Stripe's answer to a key reused with different parameters (not two requests at once). */
export function isIdempotencyParameterMismatch(err: unknown): boolean {
  const e = err as { type?: unknown; code?: unknown } | null;
  return e?.type === "StripeIdempotencyError" && e.code !== "idempotency_key_in_use";
}

/** A short, stable fingerprint of a checkout's parameters (the key itself left out). */
function parametersFingerprint(input: CreateCheckoutSessionInput): string {
  const { idempotencyKey: _key, ...rest } = input;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex").slice(0, 16);
}
