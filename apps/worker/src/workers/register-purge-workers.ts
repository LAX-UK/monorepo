import { PURGE_QR_CODE_SCANS_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { purgeQrCodeScans } from "../jobs/purge-qr-code-scans.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type PurgeWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerPurgeWorkers(deps: WorkerBootstrapDeps): PurgeWorkersHandle {
  const {
    env,
    log,
    bullConnection,
    queueOpts,
    qrCodeScanPurgeRepo,
    sentryMonitorSlugs,
    reportWorkerJobFailure,
  } = deps;

  const purgeQrCodeScansQueue = new Queue(
    PURGE_QR_CODE_SCANS_QUEUE_NAME,
    queueOpts(PURGE_QR_CODE_SCANS_QUEUE_NAME),
  );
  const purgeQrCodeScansWorker = new Worker(
    PURGE_QR_CODE_SCANS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-qr-code-scans", sentryMonitorSlugs, async () => {
        const { deleted } = await purgeQrCodeScans({
          qrCodeScanPurgeRepo,
          log,
          retentionDays: env.QR_SCAN_RETENTION_DAYS,
        });
        log.info(
          { deleted, retentionDays: env.QR_SCAN_RETENTION_DAYS },
          "purge-qr-code-scans: done",
        );
      });
    },
    bullConnection,
  );
  purgeQrCodeScansWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(PURGE_QR_CODE_SCANS_QUEUE_NAME, job, err);
  });
  void purgeQrCodeScansQueue.add(
    "purge",
    {},
    {
      jobId: "purge-qr-code-scans-daily",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 5,
    },
  );

  return {
    errorHandlers: [{ worker: purgeQrCodeScansWorker, queue: PURGE_QR_CODE_SCANS_QUEUE_NAME }],
    close: () => closeAll([purgeQrCodeScansWorker, purgeQrCodeScansQueue]),
  };
}
