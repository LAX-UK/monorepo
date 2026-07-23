import type Stripe from "stripe";

export type StripeWebhookIngressResult =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: 401 | 503 | 500; body: Record<string, unknown> };

export interface IStripeWebhookIngressApplicationService {
  handleConnectedAccountEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult>;
  handleTransferEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult>;
  handlePaymentEvent(
    rawBody: string,
    signature: string | undefined,
  ): Promise<StripeWebhookIngressResult>;
}

export type { Stripe };
