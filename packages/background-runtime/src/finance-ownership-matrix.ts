import type { FinanceCronInternalJobPath } from "./finance-cron-paths.js";
import { BACKGROUND_OPERATION_REGISTRY } from "./registry.js";

/** Finance cron jobs that must not delegate to API when worker owns execution. */
export const FINANCE_CRON_LOCAL_JOB_PATHS = [
  "expire-stale-payments",
  "retry-refund-reconciles",
  "refresh-xero-tokens",
  "retry-xero-webhook-failures",
  "retry-xero-stripe-capture-sync",
  "retry-xero-invoice-creation",
  "ensure-lot-invoices",
  "process-notification-outbox",
  "cleanup-display-pairings",
  "bulk-payout-settlement",
] as const satisfies readonly FinanceCronInternalJobPath[];

export type FinanceCronLocalJobPath = (typeof FINANCE_CRON_LOCAL_JOB_PATHS)[number];

/** Xero live projector operations that must not call API internal cron when worker owns writes. */
export const XERO_LIVE_LOCAL_OPERATIONS = [
  "record_stripe_capture",
  "record_refund_credit_note",
  "ensure_lot_invoice",
  "sync_payout_bill",
  "acknowledge_payout_settlement",
  "sync_invoice_webhook",
] as const;

export function listFinanceCronBackgroundOperationIds(): string[] {
  return BACKGROUND_OPERATION_REGISTRY.filter((op) => op.kind === "finance_cron").map(
    (op) => op.id,
  );
}

/** Fail CI when worker finance handlers still contain API rollback delegation markers. */
export function assertWorkerFinanceHandlersAreLocal(source: string): void {
  const forbidden = ["apiRollbackCron(", "postInternalCronJob("];
  for (const marker of forbidden) {
    if (source.includes(marker)) {
      throw new Error(
        `worker finance handlers must execute locally (found forbidden ${marker.trim()}); see finance-ownership-matrix`,
      );
    }
  }
}
