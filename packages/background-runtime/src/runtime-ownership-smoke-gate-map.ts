import type { RUNTIME_OWNERSHIP_SMOKE_GATES } from "./smoke-gates.js";

/** Vitest suite paths (repo-root relative) that must pass before finance/lifecycle cutover. */
export const RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP: Record<
  (typeof RUNTIME_OWNERSHIP_SMOKE_GATES)[number],
  string
> = {
  "payment.expire_stale_payments": "packages/finance-cron-app/src/finance-cron-app.test.ts",
  "payment.refund_reconcile_replay": "packages/finance-cron-app/src/finance-cron-app.test.ts",
  "xero.token_refresh": "packages/finance-cron-app/src/accounting-replay-cron.service.test.ts",
  "xero.invoice_creation_retry":
    "packages/finance-cron-app/src/accounting-replay-cron.service.test.ts",
  "xero.stripe_capture_sync_retry":
    "packages/finance-cron-app/src/accounting-replay-cron.service.test.ts",
  "xero.webhook_failure_retry":
    "packages/finance-cron-app/src/accounting-replay-cron.service.test.ts",
  "settlement.ensure_lot_invoices": "packages/finance-cron-app/src/finance-cron-app.test.ts",
  "settlement.bulk_payout":
    "packages/finance-runtime/src/payout/payout-bulk-settlement-parity.test.ts",
  "notification.outbox_drain": "packages/finance-cron-app/src/finance-cron-app.test.ts",
  "lifecycle.timed_transitions": "apps/worker/src/lifecycle/worker-lifecycle-parity.test.ts",
  "lifecycle.delayed_queue_jobs": "apps/worker/src/lifecycle/process-lot-lifecycle-job.test.ts",
  "lifecycle.bullmq_redis_integration":
    "apps/worker/src/lifecycle/register-lot-lifecycle-worker.integration.test.ts",
  "lifecycle.absentee_replay": "packages/bidding-runtime/src/absentee-replay-idempotency.test.ts",
  "projector.xero_delivery_ledger": "apps/worker/src/projectors/xero-projector.test.ts",
  "webhook.xero_inbox_enqueue": "apps/worker/src/jobs/process-inbound-webhook-event.test.ts",
};

export function listRuntimeOwnershipSmokeGateSuitePaths(): string[] {
  return [...new Set(Object.values(RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP))];
}
