export const EXPIRE_STALE_PAYMENTS_QUEUE_NAME = "expire-stale-payments" as const;
export const RETRY_XERO_WEBHOOK_FAILURES_QUEUE_NAME = "retry-xero-webhook-failures" as const;
export const RETRY_XERO_STRIPE_CAPTURE_SYNC_QUEUE_NAME = "retry-xero-stripe-capture-sync" as const;
export const RETRY_XERO_INVOICE_CREATION_QUEUE_NAME = "retry-xero-invoice-creation" as const;
export const RETRY_REFUND_RECONCILES_QUEUE_NAME = "retry-refund-reconciles" as const;
export const REFRESH_XERO_TOKENS_QUEUE_NAME = "refresh-xero-tokens" as const;
export const ENSURE_LOT_INVOICES_QUEUE_NAME = "ensure-lot-invoices" as const;
export const CLEANUP_DISPLAY_PAIRINGS_QUEUE_NAME = "cleanup-display-pairings" as const;
/** Watches the Zoho Books document queue: work waiting too long for a person or the sender. */
export const ACCOUNTING_WATCH_QUEUE_NAME = "accounting-watch" as const;
/**
 * The nightly Zoho Books status check: reads issued documents back from Books and records what
 * staff changed there by hand. Never marks anything paid.
 */
export const ACCOUNTING_RECONCILE_QUEUE_NAME = "accounting-reconcile" as const;

/** @deprecated Import from `@auction/queues` platform cron names; kept for worker/API importers. */
export { LOT_LIFECYCLE_TICK_QUEUE_NAME } from "./queue-names-platform-cron.js";
/** @deprecated Import from `@auction/queues` platform cron names; kept for worker/API importers. */
export { PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME } from "./queue-names-platform-cron.js";
/** @deprecated Import from `@auction/queues` platform cron names; kept for worker/API importers. */
export { STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME } from "./queue-names-platform-cron.js";
