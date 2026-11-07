import { pruneAlertRetention } from "@auction/alerts";
import {
  PURGE_ALERT_RETENTION_QUEUE_NAME,
  PURGE_KYC_RETENTION_QUEUE_NAME,
  PURGE_QR_CODE_SCANS_QUEUE_NAME,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { purgeKycRetentionJob } from "../jobs/purge-kyc-retention.js";
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
    kycRetentionStores,
    alertRetentionStores,
    uploadStorage,
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

  const purgeKycRetentionQueue = new Queue(
    PURGE_KYC_RETENTION_QUEUE_NAME,
    queueOpts(PURGE_KYC_RETENTION_QUEUE_NAME),
  );
  const purgeKycRetentionWorker = new Worker(
    PURGE_KYC_RETENTION_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-kyc-retention", sentryMonitorSlugs, async () => {
        await purgeKycRetentionJob({
          stores: kycRetentionStores,
          storage: uploadStorage,
          log,
          dryRun: !env.KYC_RETENTION_PURGE_ENABLED,
        });
      });
    },
    bullConnection,
  );
  purgeKycRetentionWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(PURGE_KYC_RETENTION_QUEUE_NAME, job, err);
  });
  void purgeKycRetentionQueue.add(
    "purge",
    {},
    {
      jobId: "purge-kyc-retention-daily",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 5,
    },
  );

  // Bid's alert sign-ups and logs, pruned by the shared rules in @auction/alerts.
  const purgeAlertRetentionQueue = new Queue(
    PURGE_ALERT_RETENTION_QUEUE_NAME,
    queueOpts(PURGE_ALERT_RETENTION_QUEUE_NAME),
  );
  const purgeAlertRetentionWorker = new Worker(
    PURGE_ALERT_RETENTION_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-alert-retention", sentryMonitorSlugs, async () => {
        await pruneAlertRetention({
          stores: alertRetentionStores,
          log,
          dryRun: !env.ALERT_RETENTION_PURGE_ENABLED,
        });
      });
    },
    bullConnection,
  );
  purgeAlertRetentionWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(PURGE_ALERT_RETENTION_QUEUE_NAME, job, err);
  });
  void purgeAlertRetentionQueue.add(
    "purge",
    {},
    {
      jobId: "purge-alert-retention-daily",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 5,
    },
  );

  return {
    errorHandlers: [
      { worker: purgeQrCodeScansWorker, queue: PURGE_QR_CODE_SCANS_QUEUE_NAME },
      { worker: purgeKycRetentionWorker, queue: PURGE_KYC_RETENTION_QUEUE_NAME },
      { worker: purgeAlertRetentionWorker, queue: PURGE_ALERT_RETENTION_QUEUE_NAME },
    ],
    close: () =>
      closeAll([
        purgeQrCodeScansWorker,
        purgeQrCodeScansQueue,
        purgeKycRetentionWorker,
        purgeKycRetentionQueue,
        purgeAlertRetentionWorker,
        purgeAlertRetentionQueue,
      ]),
  };
}
