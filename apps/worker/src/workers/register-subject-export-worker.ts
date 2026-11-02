import {
  SUBJECT_DATA_EXPORT_JOB_NAMES,
  SUBJECT_DATA_EXPORT_QUEUE_NAME,
  type SubjectDataExportJobPayload,
} from "@auction/queues";
import { type Job, Queue, UnrecoverableError, Worker } from "bullmq";
import { createSubjectExportRequestRelay } from "../jobs/subject-export-request-relay.js";
import { createSubjectExportRuntime } from "../subject-export/create-subject-export-runtime.js";
import { purgeSubjectExportObjects } from "../subject-export/purge-subject-export-objects.js";
import { SubjectExportTerminalError } from "../subject-export/subject-export-assembler.js";
import { subjectExportConfigFromEnv } from "../subject-export/subject-export.config.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** Two copies at once: each streams to disk, so more would only compete for it. */
export const SUBJECT_EXPORT_CONCURRENCY = 2;
const PURGE_EVERY_MS = 60 * 60 * 1000;

export type SubjectExportWorkerHandle = {
  /** Queues an assemble job for each export request in a relayed batch. */
  relayObserver: ReturnType<typeof createSubjectExportRequestRelay>;
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  close: () => Promise<void>;
};

/**
 * "Download my data". The queue always exists, so a request made before the credentials and bucket
 * are in place waits instead of being lost. The consumer starts only when they are all set; until
 * then nothing is collected.
 */
export function registerSubjectExportWorker(deps: WorkerBootstrapDeps): SubjectExportWorkerHandle {
  const { env, log, bullConnection, queueOpts, reportWorkerJobFailure } = deps;
  const queue = new Queue(
    SUBJECT_DATA_EXPORT_QUEUE_NAME,
    queueOpts(SUBJECT_DATA_EXPORT_QUEUE_NAME),
  );
  const relayObserver = createSubjectExportRequestRelay(queue);

  const config = subjectExportConfigFromEnv(env);
  if (!config) {
    log.info("download-my-data is not configured; requests wait in the subject-data-export queue");
    return { relayObserver, errorHandlers: [], dlqHandlers: [], close: () => closeAll([queue]) };
  }

  const runtime = createSubjectExportRuntime(config, log);
  const worker = new Worker<SubjectDataExportJobPayload>(
    SUBJECT_DATA_EXPORT_QUEUE_NAME,
    async (job: Job<SubjectDataExportJobPayload>) => {
      if (job.name === SUBJECT_DATA_EXPORT_JOB_NAMES.purgeObjects) {
        // Copies that could not be deleted stay pending and are tried again at the next run.
        await purgeSubjectExportObjects({ ledger: runtime.ledger, store: runtime.store, log });
        return;
      }
      try {
        await runtime.assembler.run(
          { exportId: job.data.exportId, subjectId: job.data.subjectId },
          {
            number: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts ?? 1,
            queuedAt: new Date(job.timestamp),
          },
        );
      } catch (error) {
        // Identity has been told how it ended; the queue must not run it again by itself.
        if (error instanceof SubjectExportTerminalError) throw new UnrecoverableError(error.code);
        throw error;
      }
    },
    { ...bullConnection, concurrency: SUBJECT_EXPORT_CONCURRENCY },
  );
  worker.on("failed", (job, err) => {
    reportWorkerJobFailure(SUBJECT_DATA_EXPORT_QUEUE_NAME, job, err);
  });
  void queue.add(
    SUBJECT_DATA_EXPORT_JOB_NAMES.purgeObjects,
    {},
    {
      jobId: "subject-data-export-purge",
      repeat: { every: PURGE_EVERY_MS },
      attempts: 1,
      removeOnComplete: 5,
      removeOnFail: 20,
    },
  );

  return {
    relayObserver,
    errorHandlers: [{ worker, queue: SUBJECT_DATA_EXPORT_QUEUE_NAME }],
    dlqHandlers: [{ name: SUBJECT_DATA_EXPORT_QUEUE_NAME, worker }],
    close: () => closeAll([worker, queue]),
  };
}
