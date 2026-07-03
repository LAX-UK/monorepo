import type { IEmailService } from "@auction/email";
import { createExportProviderDeps } from "@auction/exports/providers";
import {
  DATA_EXPORT_QUEUE_NAME,
  IMPERSONATION_SWEEPER_QUEUE_NAME,
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
} from "@auction/queues";
import type { DataExportJobPayload } from "@auction/queues";
import { type Job, Queue, Worker } from "bullmq";
import { dataExportJob } from "../jobs/data-export.js";
import { runImpersonationSweeperJob } from "../jobs/impersonation-sweeper.js";
import { runLegalEntityArchiveCascadeJob } from "../jobs/legal-entity-archive-cascade.js";
import { purgeExpiredExportsJob } from "../jobs/purge-expired-exports.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

type LegalEntityArchiveJobData = { legalEntityId: string };

export type ComplianceWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  close: () => Promise<void>;
};

export type ComplianceWorkersOptions = {
  emailOutboxService: IEmailService;
};

export function registerComplianceWorkers(
  deps: WorkerBootstrapDeps,
  options: ComplianceWorkersOptions,
): ComplianceWorkersHandle {
  const {
    env,
    db,
    redis,
    log,
    bullConnection,
    queueOpts,
    uploadStorage,
    repoFactory,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  } = deps;
  const { emailOutboxService } = options;

  const exportProviderDeps = createExportProviderDeps(db);
  const dataExportQueue = new Queue(DATA_EXPORT_QUEUE_NAME, queueOpts(DATA_EXPORT_QUEUE_NAME));
  const dataExportWorker = new Worker(
    DATA_EXPORT_QUEUE_NAME,
    async (job) => {
      if (job.name === "purge-expired") {
        await purgeExpiredExportsJob({ db, storage: uploadStorage, log });
        return;
      }
      await dataExportJob(
        { db, redis, storage: uploadStorage, providerDeps: exportProviderDeps, log },
        job as Job<DataExportJobPayload>,
      );
      await heartbeat("data-export");
    },
    {
      ...bullConnection,
      concurrency: 2,
      limiter: { max: 10, duration: 1000 },
    },
  );
  dataExportWorker.on("completed", () => void heartbeat("data-export"));
  dataExportWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(DATA_EXPORT_QUEUE_NAME, job, err);
  });
  void dataExportQueue.add(
    "purge-expired",
    {},
    {
      jobId: "purge-expired-exports-daily",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 5,
    },
  );

  const legalEntityArchiveQueue = new Queue<LegalEntityArchiveJobData>(
    LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
    queueOpts(LEGAL_ENTITY_ARCHIVE_QUEUE_NAME),
  );
  const legalEntityArchiveWorker = new Worker<LegalEntityArchiveJobData>(
    LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
    async (job) => {
      const legalEntityId = String(job.data?.legalEntityId ?? "");
      if (!legalEntityId) {
        throw new Error("legal-entity-archive job is missing legalEntityId");
      }
      await runLegalEntityArchiveCascadeJob({
        db,
        repoFactory,
        emailService: emailOutboxService,
        log,
        webOrigin: env.WEB_ORIGIN,
        supportContactEmail: env.EMAIL_REPLY_TO ?? "support@lax.bid",
        legalEntityId,
      });
      await heartbeat("legal-entity-archive");
    },
    bullConnection,
  );
  legalEntityArchiveWorker.on("completed", () => void heartbeat("legal-entity-archive"));

  const impersonationSweeperQueue = new Queue(
    IMPERSONATION_SWEEPER_QUEUE_NAME,
    queueOpts(IMPERSONATION_SWEEPER_QUEUE_NAME),
  );
  const impersonationSweeperWorker = new Worker(
    IMPERSONATION_SWEEPER_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("impersonation-sweeper", sentryMonitorSlugs, async () => {
        await runImpersonationSweeperJob({ db, log });
        await heartbeat("impersonation-sweeper");
      });
    },
    bullConnection,
  );
  impersonationSweeperWorker.on("completed", () => void heartbeat("impersonation-sweeper"));
  void impersonationSweeperQueue.add(
    "sweep-stale-impersonations",
    {},
    {
      jobId: "impersonation-sweeper-repeat",
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 10,
    },
  );

  return {
    errorHandlers: [
      { worker: dataExportWorker, queue: DATA_EXPORT_QUEUE_NAME },
      { worker: legalEntityArchiveWorker, queue: LEGAL_ENTITY_ARCHIVE_QUEUE_NAME },
      { worker: impersonationSweeperWorker, queue: IMPERSONATION_SWEEPER_QUEUE_NAME },
    ],
    dlqHandlers: [{ name: LEGAL_ENTITY_ARCHIVE_QUEUE_NAME, worker: legalEntityArchiveWorker }],
    close: () =>
      closeAll([
        dataExportWorker,
        dataExportQueue,
        legalEntityArchiveWorker,
        legalEntityArchiveQueue,
        impersonationSweeperWorker,
        impersonationSweeperQueue,
      ]),
  };
}
