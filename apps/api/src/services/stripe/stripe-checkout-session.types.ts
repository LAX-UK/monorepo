export type StripeCheckoutLineItem = {
  name: string;
  description?: string;
  unitAmountCents: number;
  metadata?: Record<string, string>;
  images?: string[];
};

export type CreateCheckoutSessionInput = {
  paymentId: string;
  lotId: string;
  amountCents: number;
  currency: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: StripeCheckoutLineItem[];
  paymentIntentDescription: string;
  statementDescriptorSuffix: string;
  /** Override Stripe idempotency key (defaults to rail + payment id). */
  idempotencyKey?: string;
};

export type CreateBankTransferCheckoutSessionInput = CreateCheckoutSessionInput & {
  stripeCustomerId: string;
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
  paymentIntentId: string | null;
};
