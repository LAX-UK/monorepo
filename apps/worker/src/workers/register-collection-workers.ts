import type { IEmailService } from "@auction/email";
import type { ICollectionLotFactsReader } from "@auction/persistence/interfaces";
import { COLLECTION_REMINDERS_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import type { ICollectByReader } from "../interfaces/collect-by.reader.js";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import { runCollectByRemindersJob } from "../jobs/collection-collect-by-reminders.js";
import { runCollectionRemindersJob } from "../jobs/collection-reminders.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type CollectionWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export type CollectionWorkersOptions = {
  emailService: IEmailService;
  reader: ICollectionNoticeReader;
  collectByReader: ICollectByReader;
  lotFacts: ICollectionLotFactsReader;
};

/** Every 15 minutes: the sweep finds nothing until 09:00 London time, then sends each reminder once. */
const SWEEP_EVERY_MS = 15 * 60 * 1000;

/**
 * The collection reminder sweep: the day-before visit reminders, then the storage reminders for
 * the "please collect by" day. The booking emails themselves go out from the projector.
 */
export function registerCollectionWorkers(
  deps: WorkerBootstrapDeps,
  options: CollectionWorkersOptions,
): CollectionWorkersHandle {
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;

  const queue = new Queue(COLLECTION_REMINDERS_QUEUE_NAME, bullConnection);
  const worker = new Worker(
    COLLECTION_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(COLLECTION_REMINDERS_QUEUE_NAME, sentryMonitorSlugs, async () => {
        // Two sweeps in one job: a failure of one is reported and must not skip the other.
        const failures: unknown[] = [];
        try {
          await runCollectionRemindersJob({
            reader: options.reader,
            emailService: options.emailService,
            config: {
              organizer: {
                email: env.COLLECTION_ORGANIZER_EMAIL,
                name: env.COLLECTION_ORGANIZER_NAME,
              },
              webOrigin: env.WEB_ORIGIN,
            },
            log,
          });
        } catch (err) {
          log.error({ err }, "collection_visit_reminders_failed");
          failures.push(err);
        }
        try {
          await runCollectByRemindersJob({
            reader: options.collectByReader,
            notices: options.reader,
            facts: options.lotFacts,
            emailService: options.emailService,
            webOrigin: env.WEB_ORIGIN,
            log,
          });
        } catch (err) {
          log.error({ err }, "collection_collect_by_sweep_failed");
          failures.push(err);
        }
        // Report to Sentry and the queue by failing the job, after both have run.
        if (failures.length > 0) throw failures[0];
        await heartbeat(COLLECTION_REMINDERS_QUEUE_NAME);
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => {
    reportWorkerJobFailure(COLLECTION_REMINDERS_QUEUE_NAME, job, err);
  });
  void queue.add(
    COLLECTION_REMINDERS_QUEUE_NAME,
    {},
    {
      jobId: "quarter-hourly-collection-reminders",
      repeat: { every: SWEEP_EVERY_MS },
      removeOnComplete: 50,
    },
  );
  log.info("collection-reminders repeat registered (every 15 minutes)");

  return {
    errorHandlers: [{ worker, queue: COLLECTION_REMINDERS_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
