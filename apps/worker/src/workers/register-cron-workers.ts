import {
  CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
  CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME,
  SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
  STAFF_ROLE_EXPIRY_QUEUE_NAME,
  STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
  WATCHED_LOT_REMINDERS_QUEUE_NAME,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { runConsignmentAgreementRemindersJob } from "../jobs/consignment-agreement-reminders.js";
import { runConsignmentThreadSweepJob } from "../jobs/consignment-thread-sweep.js";
import { runShopStockReconciliationJob } from "../jobs/shop-stock-reconciliation.job.js";
import { runStaffRoleExpiryJob } from "../jobs/staff-role-expiry.js";
import { runStaleSubmissionDraftRemindersJob } from "../jobs/stale-submission-draft-reminders.js";
import { runWatchedLotRemindersJob } from "../jobs/watched-lot-reminders.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import { registerFinanceAndLifecycleCronWorkers } from "./register-finance-cron-workers.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type CronWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerCronWorkers(deps: WorkerBootstrapDeps): CronWorkersHandle {
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;

  const errorHandlers: WorkerErrorHandlerEntry[] = [];
  const closables: Array<{ close: () => Promise<void> }> = [];

  const cronSecret = env.CRON_INTERNAL_SECRET ?? "";

  if (env.LIFECYCLE_EXECUTION_OWNER === "worker") {
    const lifecyclePartial = registerFinanceAndLifecycleCronWorkers(deps, cronSecret, {
      lifecycleTickOnly: true,
    });
    errorHandlers.push(...lifecyclePartial.errorHandlers);
    closables.push(...lifecyclePartial.closables);
  }

  if (!env.CRON_INTERNAL_SECRET) {
    return {
      errorHandlers,
      close: () => closeAll(closables),
    };
  }

  const financePartial = registerFinanceAndLifecycleCronWorkers(deps, cronSecret, {
    skipLifecycleTick: env.LIFECYCLE_EXECUTION_OWNER === "worker",
  });
  errorHandlers.push(...financePartial.errorHandlers);
  closables.push(...financePartial.closables);

  const staleSubmissionDraftRemindersQueue = new Queue(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    bullConnection,
  );
  const staleSubmissionDraftRemindersWorker = new Worker(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runStaleSubmissionDraftRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  staleSubmissionDraftRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME, job, err);
  });
  void staleSubmissionDraftRemindersQueue.add(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
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

  const agreementRemindersQueue = new Queue(
    CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
    bullConnection,
  );
  const agreementRemindersWorker = new Worker(
    CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runConsignmentAgreementRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat(CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  agreementRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME, job, err);
  });
  // Hourly: a reminder goes out within an hour of day 3 and day 7; the API sends each once.
  void agreementRemindersQueue.add(
    CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
    {},
    {
      jobId: "hourly-consignment-agreement-reminders",
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("consignment-agreement-reminders repeat registered (hourly)");
  errorHandlers.push({
    worker: agreementRemindersWorker,
    queue: CONSIGNMENT_AGREEMENT_REMINDERS_QUEUE_NAME,
  });
  closables.push(agreementRemindersWorker, agreementRemindersQueue);

  const watchedLotRemindersQueue = new Queue(WATCHED_LOT_REMINDERS_QUEUE_NAME, bullConnection);
  const watchedLotRemindersWorker = new Worker(
    WATCHED_LOT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        WATCHED_LOT_REMINDERS_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runWatchedLotRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat(WATCHED_LOT_REMINDERS_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  watchedLotRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(WATCHED_LOT_REMINDERS_QUEUE_NAME, job, err);
  });
  // Every five minutes: an hour-before reminder arrives between 55 and 60 minutes before close.
  void watchedLotRemindersQueue.add(
    WATCHED_LOT_REMINDERS_QUEUE_NAME,
    {},
    {
      jobId: "five-minutely-watched-lot-reminders",
      repeat: { every: 5 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("watched-lot-reminders repeat registered (every 5 minutes)");
  errorHandlers.push({
    worker: watchedLotRemindersWorker,
    queue: WATCHED_LOT_REMINDERS_QUEUE_NAME,
  });
  closables.push(watchedLotRemindersWorker, watchedLotRemindersQueue);

  const staffRoleExpiryQueue = new Queue(STAFF_ROLE_EXPIRY_QUEUE_NAME, bullConnection);
  const staffRoleExpiryWorker = new Worker(
    STAFF_ROLE_EXPIRY_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(STAFF_ROLE_EXPIRY_QUEUE_NAME, sentryMonitorSlugs, async () => {
        await runStaffRoleExpiryJob({
          apiBaseUrl: env.API_INTERNAL_BASE_URL,
          cronSecret,
          log,
        });
        await heartbeat(STAFF_ROLE_EXPIRY_QUEUE_NAME);
      });
    },
    bullConnection,
  );
  staffRoleExpiryWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(STAFF_ROLE_EXPIRY_QUEUE_NAME, job, err);
  });
  // Daily: the API records each ended role once, so a repeat or overlap sends nothing twice.
  void staffRoleExpiryQueue.add(
    STAFF_ROLE_EXPIRY_QUEUE_NAME,
    {},
    {
      jobId: "daily-staff-role-expiry",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("staff-role-expiry repeat registered (daily)");
  errorHandlers.push({ worker: staffRoleExpiryWorker, queue: STAFF_ROLE_EXPIRY_QUEUE_NAME });
  closables.push(staffRoleExpiryWorker, staffRoleExpiryQueue);

  const threadSweepQueue = new Queue(CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME, bullConnection);
  const threadSweepWorker = new Worker(
    CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runConsignmentThreadSweepJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat(CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  threadSweepWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME, job, err);
  });
  // Every few minutes: a reply whose delivery job was lost reaches the account within one sweep,
  // and a cover ends close to its end date. The API does each at most once.
  void threadSweepQueue.add(
    CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME,
    {},
    {
      jobId: "five-minute-consignment-thread-sweep",
      repeat: { every: 5 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("consignment-thread-sweep repeat registered (every 5 minutes)");
  errorHandlers.push({ worker: threadSweepWorker, queue: CONSIGNMENT_THREAD_SWEEP_QUEUE_NAME });
  closables.push(threadSweepWorker, threadSweepQueue);

  const shopStockReconciliationQueue = new Queue(
    SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
    bullConnection,
  );
  const shopStockReconciliationWorker = new Worker(
    SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runShopStockReconciliationJob();
          await heartbeat(SHOP_STOCK_RECONCILIATION_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  shopStockReconciliationWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(SHOP_STOCK_RECONCILIATION_QUEUE_NAME, job, err);
  });
  void shopStockReconciliationQueue.add(
    SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
    {},
    {
      jobId: "daily-shop-stock-reconciliation",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("shop-stock-reconciliation repeat registered (daily)");
  errorHandlers.push({
    worker: shopStockReconciliationWorker,
    queue: SHOP_STOCK_RECONCILIATION_QUEUE_NAME,
  });
  closables.push(shopStockReconciliationWorker, shopStockReconciliationQueue);

  return {
    errorHandlers,
    close: () => closeAll(closables),
  };
}
