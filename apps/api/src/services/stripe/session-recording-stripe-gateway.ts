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
    private readonly sessions: Pick<IPaymentCheckoutSessionStore, "record">,
  ) {}

  isConfigured() {
    return this.inner.isConfigured();
  }

  async createCardCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const created = await this.inner.createCardCheckoutSession(input);
    await this.sessions.record(input.paymentId, created.sessionId);
    return created;
  }

  async createBankTransferCheckoutSession(
    input: CreateBankTransferCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const created = await this.inner.createBankTransferCheckoutSession(input);
    await this.sessions.record(input.paymentId, created.sessionId);
    return created;
  }

  retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.inner.retrievePaymentIntent(paymentIntentId);
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
