import {
  GC_PENDING_UPLOADS_QUEUE_NAME,
  IMAGE_CLEANUP_QUEUE_NAME,
  PROCESS_IMAGE_QUEUE_NAME,
  QR_CODE_SCAN_QUEUE_NAME,
  VALIDATE_UPLOAD_QUEUE_NAME,
} from "@auction/queues";
import type { QrCodeScanJobPayload } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { cleanupImageJob } from "../jobs/image-cleanup.js";
import { processImageJob } from "../jobs/process-image.js";
import { purgeSourceOfFundsDocumentsJob } from "../jobs/purge-source-of-funds-documents.js";
import { recordQrCodeScanJob } from "../jobs/qr-code-scan.js";
import { gcPendingUploads, validateUploadJob } from "../jobs/validate-upload.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type MediaWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerMediaWorkers(deps: WorkerBootstrapDeps): MediaWorkersHandle {
  const {
    bullConnection,
    queueOpts,
    db,
    uploadValidationRepo,
    uploadStorage,
    log,
    malwareScanner,
    imageProcessor,
    publicUploadBase,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  } = deps;

  const processImageQueue = new Queue(
    PROCESS_IMAGE_QUEUE_NAME,
    queueOpts(PROCESS_IMAGE_QUEUE_NAME),
  );

  const validateUploadWorker = new Worker(
    VALIDATE_UPLOAD_QUEUE_NAME,
    async (job) => {
      const uploadId = String((job.data as { uploadId?: unknown }).uploadId ?? "");
      if (!uploadId) {
        throw new Error("validate-upload job is missing uploadId");
      }
      const result = await validateUploadJob({
        uploadValidationRepo,
        storage: uploadStorage,
        uploadId,
        log,
        malwareScanner,
      });
      if (result.validated && result.key) {
        await processImageQueue.add("process-image", { key: result.key });
      }
      await heartbeat("validate-upload");
    },
    bullConnection,
  );
  validateUploadWorker.on("completed", () => void heartbeat("validate-upload"));
  validateUploadWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("validate-upload", job, err);
  });

  const processImageWorker = new Worker(
    PROCESS_IMAGE_QUEUE_NAME,
    async (job) => {
      const key = String((job.data as { key?: unknown }).key ?? "");
      if (!key) {
        throw new Error("process-image job is missing key");
      }
      await processImageJob({ db, storage: uploadStorage, processor: imageProcessor, key, log });
      await heartbeat("process-image");
    },
    bullConnection,
  );
  processImageWorker.on("completed", () => void heartbeat("process-image"));
  processImageWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("process-image", job, err);
  });

  const imageCleanupWorker = new Worker(
    IMAGE_CLEANUP_QUEUE_NAME,
    async (job) => {
      const key = String((job.data as { key?: unknown }).key ?? "");
      if (!key) {
        throw new Error("image-cleanup job is missing key");
      }
      await cleanupImageJob({
        db,
        storage: uploadStorage,
        key,
        publicBaseUrl: publicUploadBase,
        log,
      });
      await heartbeat("image-cleanup");
    },
    bullConnection,
  );
  imageCleanupWorker.on("completed", () => void heartbeat("image-cleanup"));
  imageCleanupWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(IMAGE_CLEANUP_QUEUE_NAME, job, err);
  });

  const qrCodeScanWorker = new Worker<QrCodeScanJobPayload>(
    QR_CODE_SCAN_QUEUE_NAME,
    async (job) => {
      await recordQrCodeScanJob({ db, data: job.data, log });
      await heartbeat("qr-code-scan");
    },
    {
      ...bullConnection,
      concurrency: 10,
      limiter: { max: 300, duration: 1000 },
    },
  );
  qrCodeScanWorker.on("completed", () => void heartbeat("qr-code-scan"));
  qrCodeScanWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(QR_CODE_SCAN_QUEUE_NAME, job, err);
  });

  const gcUploadQueue = new Queue(
    GC_PENDING_UPLOADS_QUEUE_NAME,
    queueOpts(GC_PENDING_UPLOADS_QUEUE_NAME),
  );
  const gcPendingUploadsWorker = new Worker(
    GC_PENDING_UPLOADS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("gc-pending-uploads", sentryMonitorSlugs, async () => {
        await gcPendingUploads({ uploadValidationRepo, storage: uploadStorage, log });
        await purgeSourceOfFundsDocumentsJob({ db, storage: uploadStorage, log });
        await heartbeat("gc-pending-uploads");
      });
    },
    bullConnection,
  );
  gcPendingUploadsWorker.on("completed", () => void heartbeat("gc-pending-uploads"));
  void gcUploadQueue.add(
    "gc-pending-uploads",
    {},
    { jobId: "hourly-gc-pending-uploads", repeat: { every: 60 * 60 * 1000 } },
  );

  return {
    errorHandlers: [
      { worker: validateUploadWorker, queue: VALIDATE_UPLOAD_QUEUE_NAME },
      { worker: processImageWorker, queue: PROCESS_IMAGE_QUEUE_NAME },
      { worker: imageCleanupWorker, queue: IMAGE_CLEANUP_QUEUE_NAME },
      { worker: qrCodeScanWorker, queue: QR_CODE_SCAN_QUEUE_NAME },
      { worker: gcPendingUploadsWorker, queue: GC_PENDING_UPLOADS_QUEUE_NAME },
    ],
    close: () =>
      closeAll([
        validateUploadWorker,
        processImageWorker,
        processImageQueue,
        imageCleanupWorker,
        qrCodeScanWorker,
        gcPendingUploadsWorker,
        gcUploadQueue,
      ]),
  };
}
