import type { BackgroundOperationDefinition } from "./types.js";

/** Canonical inventory of background operations and intended ownership. */
export const BACKGROUND_OPERATION_REGISTRY: readonly BackgroundOperationDefinition[] = [
  {
    id: "cron.expire_stale_payments",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "expire-stale-payments",
    description: "Expire stale pending/authorized payments",
  },
  {
    id: "cron.retry_refund_reconciles",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "retry-refund-reconciles",
    description: "Replay pending Stripe refund reconciles",
  },
  {
    id: "cron.refresh_xero_tokens",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "refresh-xero-tokens",
    description: "Proactive Xero OAuth token refresh",
  },
  {
    id: "cron.retry_xero_webhook_failures",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "retry-xero-webhook-failures",
    description: "Retry failed Xero webhook sync rows",
  },
  {
    id: "cron.retry_xero_stripe_capture_sync",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "retry-xero-stripe-capture-sync",
    description: "Backfill Xero payment records for Stripe captures",
  },
  {
    id: "cron.retry_xero_invoice_creation",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "retry-xero-invoice-creation",
    description: "Create missing Xero invoices for captured payments",
  },
  {
    id: "cron.ensure_lot_invoices",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "ensure-lot-invoices",
    description: "Ensure Xero invoices for sold lots missing payment rows",
  },
  {
    id: "cron.bulk_payout_settlement",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "bulk-payout-settlement",
    description: "Bulk seller payout settlement with Stripe transfers",
  },
  {
    id: "cron.process_notification_outbox",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "process-notification-outbox",
    description: "Drain transactional notification outbox",
  },
  {
    id: "cron.cleanup_display_pairings",
    kind: "finance_cron",
    targetOwner: "worker",
    internalJobPath: "cleanup-display-pairings",
    description: "Expire stale saleroom display pairings",
  },
  {
    id: "lifecycle.tick",
    kind: "lifecycle_tick",
    targetOwner: "worker",
    internalJobPath: "lot-lifecycle-tick",
    description: "Periodic timed lot and sale status transitions",
  },
  {
    id: "lifecycle.absentee_replay",
    kind: "lifecycle_tick",
    targetOwner: "worker",
    internalJobPath: "replay-absentee-for-lot",
    description: "Absentee bid replay on lot activation (worker-local or API rollback)",
  },
  {
    id: "lifecycle.queue_consumer",
    kind: "lifecycle_queue",
    targetOwner: "worker",
    description: "BullMQ consumer for delayed activate/end lot jobs",
  },
  {
    id: "projector.xero",
    kind: "domain_event_projector",
    targetOwner: "worker",
    description: "Outbound Xero accounting projection from domain events",
  },
  {
    id: "projector.zoho",
    kind: "domain_event_projector",
    targetOwner: "worker",
    description: "Outbound Zoho CRM projection from domain events",
  },
  {
    id: "webhook.xero_inbound",
    kind: "webhook_inbound",
    targetOwner: "worker",
    description: "Xero invoice webhook business processing",
  },
] as const;

export function listBackgroundOperationsByKind(
  kind: BackgroundOperationDefinition["kind"],
): BackgroundOperationDefinition[] {
  return BACKGROUND_OPERATION_REGISTRY.filter((op) => op.kind === kind);
}
