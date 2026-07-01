import { Queue, Worker } from "bullmq";
import { runCleanupDisplayPairingsJob } from "../jobs/cleanup-display-pairings.js";
import { runLotLifecycleTickJob } from "../jobs/lot-lifecycle-tick.js";
import {
  runEnsureLotInvoicesJob,
  runExpireStalePaymentsJob,
  runProcessNotificationOutboxJob,
  runRefreshXeroTokensJob,
  runRetryRefundReconcilesJob,
  runRetryXeroInvoiceCreationJob,
  runRetryXeroStripeCaptureSyncJob,
  runRetryXeroWebhookFailuresJob,
} from "../jobs/payment-ops-cron.js";
import { runStaleSubmissionDraftRemindersJob } from "../jobs/stale-submission-draft-reminders.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

const STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME = "stale-submission-draft-reminders";
const LOT_LIFECYCLE_TICK_QUEUE_NAME = "lot-lifecycle-tick";

export type CronWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerCronWorkers(deps: WorkerBootstrapDeps): CronWorkersHandle {
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;

  const errorHandlers: WorkerErrorHandlerEntry[] = [];
  const closables: Array<{ close: () => Promise<void> }> = [];

  if (!env.CRON_INTERNAL_SECRET) {
    return {
      errorHandlers,
      close: () => closeAll(closables),
    };
  }

  const cronSecret = env.CRON_INTERNAL_SECRET;

  const lotLifecycleTickQueue = new Queue(LOT_LIFECYCLE_TICK_QUEUE_NAME, bullConnection);
  const lotLifecycleTickWorker = new Worker(
    LOT_LIFECYCLE_TICK_QUEUE_NAME,
    async () => {
      await runLotLifecycleTickJob({
        apiBaseUrl: env.API_INTERNAL_BASE_URL,
        cronSecret,
        log,
      });
      await heartbeat("lot-lifecycle-tick");
    },
    bullConnection,
  );
  lotLifecycleTickWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(LOT_LIFECYCLE_TICK_QUEUE_NAME, job, err);
  });
  void lotLifecycleTickQueue.add(
    "lot-lifecycle-tick",
    {},
    {
      jobId: "lot-lifecycle-tick-10s",
      repeat: { every: 10_000 },
      removeOnComplete: 100,
    },
  );
  log.info("lot-lifecycle-tick repeat registered (every 10s)");
  errorHandlers.push({ worker: lotLifecycleTickWorker, queue: LOT_LIFECYCLE_TICK_QUEUE_NAME });
  closables.push(lotLifecycleTickWorker, lotLifecycleTickQueue);

  const apiCronBase = {
    apiBaseUrl: env.API_INTERNAL_BASE_URL,
    cronSecret,
    log,
  };

  const registerPaymentOpsCron = (opts: {
    queueName: string;
    jobName: string;
    jobId: string;
    everyMs: number;
    sentrySlug: string;
    run: () => Promise<void>;
  }) => {
    const queue = new Queue(opts.queueName, bullConnection);
    const worker = new Worker(
      opts.queueName,
      async () => {
        await withSentryCronMonitor(opts.sentrySlug, sentryMonitorSlugs, async () => {
          await opts.run();
          await heartbeat(opts.queueName);
        });
      },
      bullConnection,
    );
    worker.on("failed", (job, err) => {
      reportWorkerJobFailure(opts.queueName, job, err);
    });
    void queue.add(
      opts.jobName,
      {},
      {
        jobId: opts.jobId,
        repeat: { every: opts.everyMs },
        removeOnComplete: 50,
      },
    );
    errorHandlers.push({ worker, queue: opts.queueName });
    closables.push(worker, queue);
    log.info(`${opts.queueName} repeat registered (every ${opts.everyMs}ms)`);
  };

  registerPaymentOpsCron({
    queueName: "expire-stale-payments",
    jobName: "expire-stale-payments",
    jobId: "expire-stale-payments-5m",
    everyMs: 5 * 60 * 1000,
    sentrySlug: "expire-stale-payments",
    run: () => runExpireStalePaymentsJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-xero-webhook-failures",
    jobName: "retry-xero-webhook-failures",
    jobId: "retry-xero-webhook-failures-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-xero-webhook-failures",
    run: () => runRetryXeroWebhookFailuresJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-xero-stripe-capture-sync",
    jobName: "retry-xero-stripe-capture-sync",
    jobId: "retry-xero-stripe-capture-sync-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-xero-stripe-capture-sync",
    run: () => runRetryXeroStripeCaptureSyncJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-xero-invoice-creation",
    jobName: "retry-xero-invoice-creation",
    jobId: "retry-xero-invoice-creation-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-xero-invoice-creation",
    run: () => runRetryXeroInvoiceCreationJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-refund-reconciles",
    jobName: "retry-refund-reconciles",
    jobId: "retry-refund-reconciles-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-refund-reconciles",
    run: () => runRetryRefundReconcilesJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "refresh-xero-tokens",
    jobName: "refresh-xero-tokens",
    jobId: "refresh-xero-tokens-6h",
    everyMs: 6 * 60 * 60 * 1000,
    sentrySlug: "refresh-xero-tokens",
    run: () => runRefreshXeroTokensJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "process-notification-outbox",
    jobName: "process-notification-outbox",
    jobId: "process-notification-outbox-1m",
    everyMs: 60 * 1000,
    sentrySlug: "process-notification-outbox",
    run: () => runProcessNotificationOutboxJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "ensure-lot-invoices",
    jobName: "ensure-lot-invoices",
    jobId: "ensure-lot-invoices-5m",
    everyMs: 5 * 60 * 1000,
    sentrySlug: "ensure-lot-invoices",
    run: () => runEnsureLotInvoicesJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "cleanup-display-pairings",
    jobName: "cleanup-display-pairings",
    jobId: "cleanup-display-pairings-1h",
    everyMs: 60 * 60 * 1000,
    sentrySlug: "cleanup-display-pairings",
    run: () => runCleanupDisplayPairingsJob(apiCronBase),
  });

  const staleSubmissionDraftRemindersQueue = new Queue(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    bullConnection,
  );
  const staleSubmissionDraftRemindersWorker = new Worker(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        "stale-submission-draft-reminders",
        sentryMonitorSlugs,
        async () => {
          await runStaleSubmissionDraftRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat("stale-submission-draft-reminders");
        },
      );
    },
    bullConnection,
  );
  staleSubmissionDraftRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME, job, err);
  });
  void staleSubmissionDraftRemindersQueue.add(
    "stale-submission-draft-reminders",
    {},
    {
      jobId: "daily-stale-submission-draft-reminders",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("stale-submission-draft-reminders repeat registered (daily)");
  errorHandlers.push({
    worker: staleSubmissionDraftRemindersWorker,
    queue: STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
  });
  closables.push(staleSubmissionDraftRemindersWorker, staleSubmissionDraftRemindersQueue);

  return {
    errorHandlers,
    close: () => closeAll(closables),
  };
}
