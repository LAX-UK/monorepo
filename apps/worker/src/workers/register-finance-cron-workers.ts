import {
  CLEANUP_DISPLAY_PAIRINGS_QUEUE_NAME,
  ENSURE_LOT_INVOICES_QUEUE_NAME,
  EXPIRE_STALE_PAYMENTS_QUEUE_NAME,
  LOT_LIFECYCLE_TICK_QUEUE_NAME,
  PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME,
  REFRESH_XERO_TOKENS_QUEUE_NAME,
  RETRY_REFUND_RECONCILES_QUEUE_NAME,
  RETRY_XERO_INVOICE_CREATION_QUEUE_NAME,
  RETRY_XERO_STRIPE_CAPTURE_SYNC_QUEUE_NAME,
  RETRY_XERO_WEBHOOK_FAILURES_QUEUE_NAME,
} from "@auction/queues";
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
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerLifecycleExecutor } from "../lifecycle/worker-lifecycle-executor.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";

export type FinanceCronWorkersPartial = {
  errorHandlers: WorkerErrorHandlerEntry[];
  closables: Array<{ close: () => Promise<void> }>;
};

export function registerFinanceAndLifecycleCronWorkers(
  deps: WorkerBootstrapDeps,
  cronSecret: string,
  opts?: { lifecycleTickOnly?: boolean; skipLifecycleTick?: boolean },
): FinanceCronWorkersPartial {
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;
  const errorHandlers: WorkerErrorHandlerEntry[] = [];
  const closables: Array<{ close: () => Promise<void> }> = [];

  const paymentOpsJobOpts = {
    env,
    cronSecret,
    log,
    financeCron: deps.financeCronDispatch,
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

  const lotLifecycleTickQueue = new Queue(LOT_LIFECYCLE_TICK_QUEUE_NAME, bullConnection);
  const lifecycleExecutor = (
    deps as WorkerBootstrapDeps & { lifecycleExecutor?: WorkerLifecycleExecutor }
  ).lifecycleExecutor;
  if (!opts?.skipLifecycleTick) {
    const lotLifecycleTickWorker = new Worker(
      LOT_LIFECYCLE_TICK_QUEUE_NAME,
      async () => {
        await runLotLifecycleTickJob({
          env: deps.env,
          apiBaseUrl: env.API_INTERNAL_BASE_URL,
          cronSecret,
          log,
          redis: deps.redis,
          ...(lifecycleExecutor ? { executor: lifecycleExecutor } : {}),
        });
        await heartbeat(LOT_LIFECYCLE_TICK_QUEUE_NAME);
      },
      bullConnection,
    );
    lotLifecycleTickWorker.on("failed", (job, err) => {
      reportWorkerJobFailure(LOT_LIFECYCLE_TICK_QUEUE_NAME, job, err);
    });
    void lotLifecycleTickQueue.add(
      LOT_LIFECYCLE_TICK_QUEUE_NAME,
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
  }

  if (opts?.lifecycleTickOnly) {
    return { errorHandlers, closables };
  }

  registerPaymentOpsCron({
    queueName: EXPIRE_STALE_PAYMENTS_QUEUE_NAME,
    jobName: EXPIRE_STALE_PAYMENTS_QUEUE_NAME,
    jobId: "expire-stale-payments-5m",
    everyMs: 5 * 60 * 1000,
    sentrySlug: EXPIRE_STALE_PAYMENTS_QUEUE_NAME,
    run: () => runExpireStalePaymentsJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: RETRY_XERO_WEBHOOK_FAILURES_QUEUE_NAME,
    jobName: RETRY_XERO_WEBHOOK_FAILURES_QUEUE_NAME,
    jobId: "retry-xero-webhook-failures-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: RETRY_XERO_WEBHOOK_FAILURES_QUEUE_NAME,
    run: () => runRetryXeroWebhookFailuresJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: RETRY_XERO_STRIPE_CAPTURE_SYNC_QUEUE_NAME,
    jobName: RETRY_XERO_STRIPE_CAPTURE_SYNC_QUEUE_NAME,
    jobId: "retry-xero-stripe-capture-sync-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: RETRY_XERO_STRIPE_CAPTURE_SYNC_QUEUE_NAME,
    run: () => runRetryXeroStripeCaptureSyncJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: RETRY_XERO_INVOICE_CREATION_QUEUE_NAME,
    jobName: RETRY_XERO_INVOICE_CREATION_QUEUE_NAME,
    jobId: "retry-xero-invoice-creation-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: RETRY_XERO_INVOICE_CREATION_QUEUE_NAME,
    run: () => runRetryXeroInvoiceCreationJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: RETRY_REFUND_RECONCILES_QUEUE_NAME,
    jobName: RETRY_REFUND_RECONCILES_QUEUE_NAME,
    jobId: "retry-refund-reconciles-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: RETRY_REFUND_RECONCILES_QUEUE_NAME,
    run: () => runRetryRefundReconcilesJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: REFRESH_XERO_TOKENS_QUEUE_NAME,
    jobName: REFRESH_XERO_TOKENS_QUEUE_NAME,
    jobId: "refresh-xero-tokens-6h",
    everyMs: 6 * 60 * 60 * 1000,
    sentrySlug: REFRESH_XERO_TOKENS_QUEUE_NAME,
    run: () => runRefreshXeroTokensJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME,
    jobName: PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME,
    jobId: "process-notification-outbox-1m",
    everyMs: 60 * 1000,
    sentrySlug: PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME,
    run: () => runProcessNotificationOutboxJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: ENSURE_LOT_INVOICES_QUEUE_NAME,
    jobName: ENSURE_LOT_INVOICES_QUEUE_NAME,
    jobId: "ensure-lot-invoices-5m",
    everyMs: 5 * 60 * 1000,
    sentrySlug: ENSURE_LOT_INVOICES_QUEUE_NAME,
    run: () => runEnsureLotInvoicesJob(paymentOpsJobOpts),
  });
  registerPaymentOpsCron({
    queueName: CLEANUP_DISPLAY_PAIRINGS_QUEUE_NAME,
    jobName: CLEANUP_DISPLAY_PAIRINGS_QUEUE_NAME,
    jobId: "cleanup-display-pairings-1h",
    everyMs: 60 * 60 * 1000,
    sentrySlug: CLEANUP_DISPLAY_PAIRINGS_QUEUE_NAME,
    run: () => runCleanupDisplayPairingsJob({ financeCron: deps.financeCronDispatch }),
  });

  return { errorHandlers, closables };
}
