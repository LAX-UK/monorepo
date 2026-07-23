import type { FinanceCronInternalJobPath } from "@auction/finance-cron-app";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import {
  type FinanceCronDispatchContext,
  dispatchFinanceCronJob,
} from "../finance/finance-cron-dispatch.js";

type JobOpts = {
  env: WorkerEnv;
  cronSecret: string;
  log: pino.Logger;
  financeCron: FinanceCronDispatchContext;
};

async function runFinanceCronPath(
  path: FinanceCronInternalJobPath,
  opts: JobOpts,
  options?: { treat409AsSuccess?: boolean; body?: Record<string, unknown> },
): Promise<void> {
  await dispatchFinanceCronJob(opts.financeCron, path, options);
}

export async function runExpireStalePaymentsJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("expire-stale-payments", opts);
}

export async function runRetryXeroWebhookFailuresJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("retry-xero-webhook-failures", opts);
}

export async function runRetryXeroStripeCaptureSyncJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("retry-xero-stripe-capture-sync", opts);
}

export async function runRetryXeroInvoiceCreationJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("retry-xero-invoice-creation", opts);
}

export async function runRetryRefundReconcilesJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("retry-refund-reconciles", opts);
}

export async function runRefreshXeroTokensJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("refresh-xero-tokens", opts);
}

export async function runProcessNotificationOutboxJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("process-notification-outbox", opts);
}

export async function runEnsureLotInvoicesJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("ensure-lot-invoices", opts);
}
