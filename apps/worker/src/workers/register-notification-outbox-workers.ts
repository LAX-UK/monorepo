import { buildPgConnectionConfig } from "@auction/identity-db/pg";
import { Sentry } from "@auction/observability";
import { PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import pg from "pg";
import {
  runProcessNotificationOutboxJob,
  runProcessNotificationOutboxWakeJob,
} from "../jobs/payment-ops-cron.js";
import {
  notificationOutboxWakeFailedRowsTotal,
  notificationOutboxWakeTotal,
} from "../lib/notification-outbox-wake-metrics.js";
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
/** The LISTEN connection gives up on a connect that does not answer within this long, then retries. */
const LISTEN_CONNECT_TIMEOUT_MS = 10_000;
/** TCP keepalive on the LISTEN connection, so the kernel notices a peer that vanished. */
const LISTEN_KEEPALIVE_INITIAL_DELAY_MS = 10_000;
const GLOBAL_CONCURRENCY_RETRY_MIN_MS = 1_000;
const GLOBAL_CONCURRENCY_RETRY_MAX_MS = 30_000;

/**
 * The notification outbox queue: the minute sweep (unchanged) plus, unless switched off, drains
 * woken by Postgres when a time-critical notification (outbid, won, lost, ending soon) commits.
 *
 * The queue runs one job at a time across every worker replica (global concurrency 1), so the
 * sweep and the woken drains never claim side by side: rows still go out one batch at a time in
 * the order they were staged, as they did with the sweep alone. The worker only starts taking jobs
 * once that limit is set on the queue; until then (Redis unavailable at boot) it retries with
 * backoff and nothing on this queue runs.
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

  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === NOTIFICATION_OUTBOX_WAKE_JOB_NAME) {
        const summary = await runProcessNotificationOutboxWakeJob(jobOpts);
        if (summary && summary.failed > 0) {
          notificationOutboxWakeTotal.inc({ outcome: "rows_failed" });
          notificationOutboxWakeFailedRowsTotal.inc(summary.failed);
          log.warn(summary, "notification_outbox_wake_rows_failed");
        } else {
          notificationOutboxWakeTotal.inc({ outcome: "drained" });
        }
        await heartbeat(queueName);
        return;
      }
      await withSentryCronMonitor(queueName, sentryMonitorSlugs, async () => {
        await runProcessNotificationOutboxJob(jobOpts);
        await heartbeat(queueName);
      });
    },
    { ...bullConnection, autorun: false },
  );
  worker.on("failed", (job, err) => {
    // A failed wake is retried by the follow-up wake and the minute sweep, so it is not reported
    // as a job failure; it is counted and sent to Sentry so a run of failures is still seen.
    if (job?.name === NOTIFICATION_OUTBOX_WAKE_JOB_NAME) {
      notificationOutboxWakeTotal.inc({ outcome: "drain_failed" });
      log.warn({ err: err.message, jobId: job.id }, "notification_outbox_wake_drain_failed");
      Sentry.captureException(err, {
        level: "warning",
        tags: { job: "notification_outbox_wake", queue: queueName },
        extra: { jobId: job.id },
      });
      return;
    }
    reportWorkerJobFailure(queueName, job, err);
  });

  let closed = false;
  let concurrencyTimer: ReturnType<typeof setTimeout> | null = null;
  const startWhenSerialised = async (failures: number): Promise<void> => {
    if (closed) return;
    try {
      await queue.setGlobalConcurrency(1);
    } catch (err) {
      const retryInMs = Math.min(
        GLOBAL_CONCURRENCY_RETRY_MAX_MS,
        GLOBAL_CONCURRENCY_RETRY_MIN_MS * 2 ** failures,
      );
      log.error({ err, retryInMs }, "notification_outbox_global_concurrency_failed");
      concurrencyTimer = setTimeout(() => void startWhenSerialised(failures + 1), retryInMs);
      concurrencyTimer.unref?.();
      return;
    }
    if (closed) return;
    worker.run().catch((err: unknown) => log.error({ err }, "notification_outbox_worker_stopped"));
  };
  void startWhenSerialised(0);
  closables.push({
    close: async () => {
      closed = true;
      if (concurrencyTimer) clearTimeout(concurrencyTimer);
    },
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
    createClient: () =>
      new pg.Client({
        ...buildPgConnectionConfig(databaseUrl),
        keepAlive: true,
        keepAliveInitialDelayMillis: LISTEN_KEEPALIVE_INITIAL_DELAY_MS,
        connectionTimeoutMillis: LISTEN_CONNECT_TIMEOUT_MS,
      }),
    onWake: () => scheduler.wake(),
    log,
  });
  void listener.start();
  closables.push({ close: () => listener.stop() });
}
