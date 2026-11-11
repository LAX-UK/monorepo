import type { IErrorReporter } from "@auction/finance-runtime";
import type { IPaymentTransferReferenceStore } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { type PaymentTransferDetails, transferDetailsOf } from "../stripe/transfer-intent.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

/**
 * Keeps the reference an intent shows, once. Idempotent, so every path that sees it can call
 * this: it is only ever written the first time. Nothing is kept for an intent that shows none.
 */
export async function rememberTransferDetails(
  store: IPaymentTransferReferenceStore,
  paymentIntentId: string,
  details: PaymentTransferDetails,
): Promise<void> {
  const { ownReference, ...owner } = details;
  if (!ownReference) return;
  await store.remember({
    stripePaymentIntentId: paymentIntentId,
    reference: ownReference,
    ...owner,
  });
}

/**
 * Saving a reference is a safeguard for a later check, never a reason to fail the payment event
 * that carried it: a failure is reported and the event carries on.
 */
async function rememberQuietly(
  store: IPaymentTransferReferenceStore,
  reporter: IErrorReporter | undefined,
  intent: Stripe.PaymentIntent,
): Promise<void> {
  try {
    await rememberTransferDetails(store, intent.id, transferDetailsOf(intent));
  } catch (cause) {
    reporter?.report({
      message: "Could not keep a bank-transfer payment's reference",
      status: 500,
      code: "transfer_reference_not_kept",
      severity: "warn",
      cause,
    });
  }
}

/**
 * `payment_intent.requires_action` is sent when a bank-transfer intent first shows its transfer
 * instructions. Card intents send it too (for authentication) and carry no reference: ignored.
 */
export class PaymentIntentRequiresActionHandler implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly references: IPaymentTransferReferenceStore,
    private readonly reporter?: IErrorReporter,
  ) {}

  async handle(
    _event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    await rememberQuietly(this.references, this.reporter, paymentIntent);
    return { processed: true, action: "skipped", reason: "transfer_reference_noted" };
  }
}

/** Notes the intent's reference, best effort, then always runs the wrapped handler. */
export class ReferenceNotingHandler implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly inner: IPaymentIntentWebhookHandler,
    private readonly references: IPaymentTransferReferenceStore,
    private readonly reporter?: IErrorReporter,
  ) {}

  async handle(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    await rememberQuietly(this.references, this.reporter, paymentIntent);
    return this.inner.handle(event, paymentIntent);
  }
}
