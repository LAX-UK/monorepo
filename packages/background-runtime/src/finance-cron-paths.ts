/** Mirrors `@auction/finance-cron-app` internal job paths for ownership checks without a hard dependency cycle. */
export type FinanceCronInternalJobPath =
  | "expire-stale-payments"
  | "retry-refund-reconciles"
  | "refresh-xero-tokens"
  | "retry-xero-webhook-failures"
  | "retry-xero-stripe-capture-sync"
  | "retry-xero-invoice-creation"
  | "ensure-lot-invoices"
  | "process-notification-outbox"
  | "cleanup-display-pairings"
  | "bulk-payout-settlement";
