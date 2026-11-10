import type { FinanceCronInternalJobPath } from "@auction/finance-cron-app";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import {
  type FinanceCronDispatchContext,
  dispatchFinanceCronJob,
} from "../finance/finance-cron-dispatch.js";
import { DEFAULT_GATEWAY_RETRY, type GatewayRetry } from "./post-internal-cron-job.js";

type JobOpts = {
  env: WorkerEnv;
  cronSecret: string;
  log: pino.Logger;
  financeCron: FinanceCronDispatchContext;
};

async function runFinanceCronPath(
  path: FinanceCronInternalJobPath,
  opts: JobOpts,
  options?: {
    treat409AsSuccess?: boolean;
    body?: Record<string, unknown>;
    gatewayRetry?: GatewayRetry;
  },
): Promise<void> {
  await dispatchFinanceCronJob(opts.financeCron, path, options);
}

export async function runExpireStalePaymentsJob(opts: JobOpts): Promise<void> {
  // Each invoice is re-read before it is touched, cancelled only while unpaid, and money found
  // paid is recorded once, so a repeat or an overlap with the first request changes nothing more.
  await runFinanceCronPath("expire-stale-payments", opts, { gatewayRetry: DEFAULT_GATEWAY_RETRY });
}

export async function runRetryXeroWebhookFailuresJob(opts: JobOpts): Promise<void> {
  await runFinanceCronPath("retry-xero-webhook-failures", opts);
}

export async function runRetryXeroStripeCaptureSyncJob(opts: JobOpts): Promise<void> {
  // A capture already recorded in Xero is skipped, and the payment call carries a per-payment
  // idempotency key, so asking again cannot record a payment twice.
  await runFinanceCronPath("retry-xero-stripe-capture-sync", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
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
  // Rows are claimed with FOR UPDATE SKIP LOCKED and a claim is only released after ten minutes,
  // so a repeat, or an overlap with the first request, takes different rows and never
  // dispatches a notification twice.
  await runFinanceCronPath("process-notification-outbox", opts, {
    gatewayRetry: DEFAULT_GATEWAY_RETRY,
  });
}

export async function runEnsureLotInvoicesJob(opts: JobOpts): Promise<void> {
  // Creating a lot's invoice is idempotent, so a briefly unavailable API is asked again.
  await runFinanceCronPath("ensure-lot-invoices", opts, { gatewayRetry: DEFAULT_GATEWAY_RETRY });
}
