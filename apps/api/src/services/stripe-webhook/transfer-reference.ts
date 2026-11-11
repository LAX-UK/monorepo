import type { IPaymentTransferReferenceStore } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: string | undefined): string | null =>
  value && UUID.test(value) ? value : null;

/** The reference a bank-transfer intent tells its sender to quote, while it still shows one. */
export function transferReferenceOf(intent: Stripe.PaymentIntent): string | null {
  const reference = intent.next_action?.display_bank_transfer_instructions?.reference?.trim();
  return reference ? reference : null;
}

/**
 * Keeps the reference an intent shows, once. Idempotent, so every event that carries it can call
 * this: it is only ever written the first time it is seen.
 */
export async function rememberTransferReference(
  store: IPaymentTransferReferenceStore,
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const reference = transferReferenceOf(intent);
  if (!reference) return;
  await store.remember({
    stripePaymentIntentId: intent.id,
    reference,
    paymentId: uuidOrNull(intent.metadata?.paymentId),
    paymentGroupId: uuidOrNull(intent.metadata?.paymentGroupId),
  });
}

/**
 * `payment_intent.requires_action` is sent when a bank-transfer intent first shows its transfer
 * instructions. Card intents send it too (for authentication) and carry no reference: ignored.
 */
export class PaymentIntentRequiresActionHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly references: IPaymentTransferReferenceStore) {}

  async handle(
    _event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    await rememberTransferReference(this.references, paymentIntent);
    return { processed: true, action: "skipped", reason: "transfer_reference_noted" };
  }
}

/** Notes the intent's reference before the wrapped handler does its own work. */
export class ReferenceNotingHandler implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly inner: IPaymentIntentWebhookHandler,
    private readonly references: IPaymentTransferReferenceStore,
  ) {}

  async handle(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    await rememberTransferReference(this.references, paymentIntent);
    return this.inner.handle(event, paymentIntent);
  }
}
