import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

type JobOpts = {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
};

export async function runExpireStalePaymentsJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "expire-stale-payments",
  });
}

export async function runRetryXeroWebhookFailuresJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "retry-xero-webhook-failures",
  });
}

export async function runRetryXeroStripeCaptureSyncJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "retry-xero-stripe-capture-sync",
  });
}

export async function runRetryXeroInvoiceCreationJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "retry-xero-invoice-creation",
  });
}

export async function runRetryRefundReconcilesJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "retry-refund-reconciles",
  });
}

export async function runRefreshXeroTokensJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "refresh-xero-tokens",
  });
}

export async function runProcessNotificationOutboxJob(opts: JobOpts): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "process-notification-outbox",
  });
}
