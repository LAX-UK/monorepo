export type PaymentWebhookResult = {
  processed: boolean;
  action?:
    | "dispute_created"
    | "dispute_funds_withdrawn"
    | "dispute_closed"
    | "refund_received"
    | "payment_intent_succeeded"
    | "payment_intent_succeeded_terminal_blocked"
    | "payment_intent_processing"
    | "payment_intent_partially_funded"
    | "payment_intent_failed"
    | "payment_intent_canceled"
    | "checkout_session_async_payment_failed"
    | "skipped";
  reason?: string;
};

export const PAYMENT_WEBHOOK_EVENT_SOURCE = "stripe_payment_webhook";
