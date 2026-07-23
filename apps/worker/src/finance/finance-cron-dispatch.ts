import type { FinanceCronInternalJobPath, IFinanceCronHandlers } from "@auction/finance-cron-app";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import { postInternalCronJob } from "../jobs/post-internal-cron-job.js";

export type FinanceCronDispatchContext = {
  env: WorkerEnv;
  log: pino.Logger;
  cronSecret: string;
  handlers: IFinanceCronHandlers | null;
};

const PATH_TO_HANDLER: Record<
  FinanceCronInternalJobPath,
  (h: IFinanceCronHandlers, env: WorkerEnv) => Promise<unknown>
> = {
  "expire-stale-payments": (h, env) =>
    h.expireStalePayments(env.PAYMENT_PENDING_EXPIRE_DAYS, env.PAYMENT_AUTHORIZED_EXPIRE_DAYS),
  "retry-refund-reconciles": (h) => h.retryRefundReconciles(),
  "refresh-xero-tokens": (h) => h.refreshXeroTokens(),
  "retry-xero-webhook-failures": (h) => h.retryXeroWebhookFailures(),
  "retry-xero-stripe-capture-sync": (h) => h.retryXeroStripeCaptureSync(),
  "retry-xero-invoice-creation": (h) => h.retryXeroInvoiceCreation(),
  "ensure-lot-invoices": (h) => h.ensureLotInvoices(),
  "process-notification-outbox": (h) => h.processNotificationOutbox(),
  "cleanup-display-pairings": (h) => h.cleanupDisplayPairings(),
  "bulk-payout-settlement": (h) => h.runBulkPayoutSettlement(),
};

export async function dispatchFinanceCronJob(
  ctx: FinanceCronDispatchContext,
  path: FinanceCronInternalJobPath,
  options?: { treat409AsSuccess?: boolean; body?: Record<string, unknown> },
): Promise<void> {
  const workerOwns =
    ctx.env.FINANCE_CRON_EXECUTION_OWNER === "worker" && !ctx.env.FINANCE_CRON_API_ROLLBACK;

  if (workerOwns && ctx.handlers == null) {
    throw new Error("finance_cron_handlers_required_for_worker_owner");
  }

  const useWorker = workerOwns && ctx.handlers != null;

  if (useWorker) {
    const handlers = ctx.handlers;
    if (!handlers) {
      throw new Error("finance_cron_handlers_required_for_worker_owner");
    }
    await PATH_TO_HANDLER[path](handlers, ctx.env);
    return;
  }

  await postInternalCronJob({
    apiBaseUrl: ctx.env.API_INTERNAL_BASE_URL,
    cronSecret: ctx.cronSecret,
    log: ctx.log,
    path,
    ...(options?.body !== undefined ? { body: options.body } : {}),
    ...(options?.treat409AsSuccess !== undefined
      ? { treat409AsSuccess: options.treat409AsSuccess }
      : {}),
  });
}
