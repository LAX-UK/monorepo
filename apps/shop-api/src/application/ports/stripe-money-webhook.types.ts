export type StripeMoneyWebhookOutcome = "processed" | "duplicate" | "ignored" | "not_applicable";

export type StripeRefundWebhookDto = {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
};

export type StripeDisputeWebhookDto = {
  eventId: string;
  stripeDisputeId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "opened" | "closed";
  outcome?: "won" | "lost" | undefined;
};
