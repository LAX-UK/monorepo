import {
  PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
  PURGE_QR_CODE_SCANS_QUEUE_NAME,
  PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { purgeExpiredVerifications } from "../jobs/purge-expired-verifications.js";
import { purgeQrCodeScans } from "../jobs/purge-qr-code-scans.js";
import { purgeSoftDeletedUsers } from "../jobs/purge-soft-deleted-users.js";
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
    verificationPurgeRepo,
    userPiiPurgeRepo,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  } = deps;

  const purgeVerificationsQueue = new Queue(
    PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
    queueOpts(PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME),
  );
  const purgeVerificationsWorker = new Worker(
    PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-expired-verifications", sentryMonitorSlugs, async () => {
        const { deleted } = await purgeExpiredVerifications(verificationPurgeRepo, { log });
        log.info({ deleted }, "purge-expired-verifications: done");
        await heartbeat("purge-expired-verifications");
      });
    },
    bullConnection,
  );
  purgeVerificationsWorker.on("completed", () => void heartbeat("purge-expired-verifications"));
  void purgeVerificationsQueue.add(
    "purge",
    {},
    {
      jobId: "purge-expired-verifications-6h",
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 10,
    },
  );

  const purgeSoftDeletedUsersQueue = new Queue(
    PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
    queueOpts(PURGE_SOFT_DELETED_USERS_QUEUE_NAME),
  );
  const purgeSoftDeletedUsersWorker = new Worker(
    PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-soft-deleted-users", sentryMonitorSlugs, async () => {
        const { processed } = await purgeSoftDeletedUsers(userPiiPurgeRepo, { log });
        log.info({ processed }, "purge-soft-deleted-users: done");
      });
    },
    bullConnection,
  );
  purgeSoftDeletedUsersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("purge-soft-deleted-users", job, err);
  });
  // Run weekly; deletions take 30 days to become eligible anyway.
  void purgeSoftDeletedUsersQueue.add(
    "purge",
    {},
    {
      jobId: "purge-soft-deleted-users-weekly",
      repeat: { every: 7 * 24 * 60 * 60 * 1000 },
      removeOnComplete: 10,
    },
  );

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
    errorHandlers: [
      { worker: purgeVerificationsWorker, queue: PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME },
      { worker: purgeSoftDeletedUsersWorker, queue: PURGE_SOFT_DELETED_USERS_QUEUE_NAME },
      { worker: purgeQrCodeScansWorker, queue: PURGE_QR_CODE_SCANS_QUEUE_NAME },
    ],
    close: () =>
      closeAll([
        purgeVerificationsWorker,
        purgeVerificationsQueue,
        purgeSoftDeletedUsersWorker,
        purgeSoftDeletedUsersQueue,
        purgeQrCodeScansWorker,
        purgeQrCodeScansQueue,
      ]),
  };
}
