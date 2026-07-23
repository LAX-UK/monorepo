/**
 * Documented pre-cutover checks (run in CI / test stack before changing defaults).
 * Each gate maps to a vitest or integration suite elsewhere in the repo.
 */
export const RUNTIME_OWNERSHIP_SMOKE_GATES = [
  "payment.expire_stale_payments",
  "payment.refund_reconcile_replay",
  "xero.token_refresh",
  "xero.invoice_creation_retry",
  "xero.stripe_capture_sync_retry",
  "xero.webhook_failure_retry",
  "settlement.ensure_lot_invoices",
  "settlement.bulk_payout",
  "notification.outbox_drain",
  "lifecycle.timed_transitions",
  "lifecycle.delayed_queue_jobs",
  "lifecycle.bullmq_redis_integration",
  "lifecycle.absentee_replay",
  "projector.xero_delivery_ledger",
  "webhook.xero_inbox_enqueue",
] as const;

export type RuntimeOwnershipSmokeGate = (typeof RUNTIME_OWNERSHIP_SMOKE_GATES)[number];
