import { buildPgConnectionConfig } from "@auction/identity-db/pg";
import { PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import pg from "pg";
import {
  runProcessNotificationOutboxJob,
  runProcessNotificationOutboxWakeJob,
} from "../jobs/payment-ops-cron.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import { NotificationOutboxWakeListener } from "../notifications/notification-outbox-wake-listener.js";
import {
  NOTIFICATION_OUTBOX_WAKE_JOB_NAME,
  NotificationOutboxWakeScheduler,
} from "../notifications/notification-outbox-wake-scheduler.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";

type JobOpts = Parameters<typeof runProcessNotificationOutboxJob>[0];

const SWEEP_JOB_ID = "process-notification-outbox-1m";
const SWEEP_EVERY_MS = 60 * 1000;

/**
 * The notification outbox queue: the minute sweep (unchanged) plus, unless switched off, drains
 * woken by Postgres when a time-critical notification (outbid, won, lost, ending soon) commits.
 *
 * The queue runs one job at a time across every worker replica (global concurrency 1), so the
 * sweep and the woken drains never claim side by side: rows still go out one batch at a time in
 * the order they were staged, as they did with the sweep alone.
 */
export function registerNotificationOutboxWorkers(input: {
  deps: WorkerBootstrapDeps;
  jobOpts: JobOpts;
  errorHandlers: WorkerErrorHandlerEntry[];
  closables: Array<{ close: () => Promise<void> }>;
}): void {
  const { deps, jobOpts, errorHandlers, closables } = input;
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;
  const queueName = PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME;

  const queue = new Queue(queueName, bullConnection);
  void queue.setGlobalConcurrency(1).catch((err: unknown) => {
    log.error({ err }, "notification_outbox_global_concurrency_failed");
  });

  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === NOTIFICATION_OUTBOX_WAKE_JOB_NAME) {
        await runProcessNotificationOutboxWakeJob(jobOpts);
        await heartbeat(queueName);
        return;
      }
      await withSentryCronMonitor(queueName, sentryMonitorSlugs, async () => {
        await runProcessNotificationOutboxJob(jobOpts);
        await heartbeat(queueName);
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => {
    // A failed wake is retried by the follow-up wake and the minute sweep; only report the sweep.
    if (job?.name === NOTIFICATION_OUTBOX_WAKE_JOB_NAME) {
      log.warn({ err: err.message, jobId: job.id }, "notification_outbox_wake_drain_failed");
      return;
    }
    reportWorkerJobFailure(queueName, job, err);
  });
  void queue.add(
    queueName,
    {},
    { jobId: SWEEP_JOB_ID, repeat: { every: SWEEP_EVERY_MS }, removeOnComplete: 50 },
  );
  errorHandlers.push({ worker, queue: queueName });
  closables.push(worker, queue);
  log.info(`${queueName} repeat registered (every ${SWEEP_EVERY_MS}ms)`);

  if (!env.NOTIFICATION_OUTBOX_WAKE_ENABLED) {
    log.info("notification outbox wake disabled; minute sweep only");
    return;
  }

  const scheduler = new NotificationOutboxWakeScheduler({
    enqueue: async ({ jobId, delayMs }) => {
      await queue.add(
        NOTIFICATION_OUTBOX_WAKE_JOB_NAME,
        {},
        { jobId, delay: delayMs, attempts: 1, removeOnComplete: true, removeOnFail: 100 },
      );
    },
    onError: (err) => log.warn({ err }, "notification_outbox_wake_enqueue_failed"),
  });
  const databaseUrl = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  const listener = new NotificationOutboxWakeListener({
    createClient: () => new pg.Client(buildPgConnectionConfig(databaseUrl)),
    onWake: () => scheduler.wake(),
    log,
  });
  void listener.start();
  closables.push({ close: () => listener.stop() });
}
