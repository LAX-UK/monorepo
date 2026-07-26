import type { createDb } from "@auction/db";
import type { IExportProviderDeps } from "@auction/exports/providers";
import type { IMarketingProfileReader } from "@auction/marketing-events";
import type {
  INotificationWriteRepository,
  IQrCodeScanPersister,
  IRepositoryFactory,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { QueueName } from "@auction/queues";
import type { QueueOptions, WorkerOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import type { IAdminReviewTaskProjectorRepository } from "../interfaces/admin-review-task-projector.repository.js";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";
import type { ILegalEntityArchiveCascadeReader } from "../interfaces/legal-entity-archive-cascade.reader.js";
import type { IMarketingAttributionPurgeRepository } from "../interfaces/marketing-attribution-purge.repository.js";
import type { IMarketingClickIdPurgeRepository } from "../interfaces/marketing-click-id-purge.repository.js";
import type { IMarketingContactSyncRepository } from "../interfaces/marketing-contact-sync.repository.js";
import type { IMarketingEventOutboxWorker } from "../interfaces/marketing-event-outbox.worker.js";
import type { IMediaAssetCleanupRepository } from "../interfaces/media-asset-cleanup.repository.js";
import type { IMediaAssetProcessorRepository } from "../interfaces/media-asset-processor.repository.js";
import type { INewsletterSignupSyncRepository } from "../interfaces/newsletter-signup-sync.repository.js";
import type { IPayoutStatementRepository } from "../interfaces/payout-statement.repository.js";
import type { IQrCodeScanPurgeRepository } from "../interfaces/qr-code-scan-purge.repository.js";
import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";
import type { IUploadValidationRepository } from "../interfaces/upload-validation.repository.js";
import type { IUserPiiPurgeRepository } from "../interfaces/user-pii-purge.repository.js";
import type { IVerificationPurgeRepository } from "../interfaces/verification-purge.repository.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import type { IMalwareScanner } from "../lib/malware-scanner.js";
import type { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import type { createUploadStorage } from "../lib/upload-storage.js";

export type WorkerDb = ReturnType<typeof createDb>;

export type WorkerErrorHandlerEntry = { worker: import("bullmq").Worker; queue: string };

export type DlqHandlerEntry = { name: QueueName; worker: import("bullmq").Worker };

export type BullConnection = WorkerOptions;

export type WorkerBootstrapDeps = {
  env: WorkerEnv;
  db: WorkerDb;
  redis: Redis;
  log: Logger;
  bullConnection: BullConnection;
  queueOpts: (name: QueueName) => QueueOptions;
  uploadStorage: ReturnType<typeof createUploadStorage>;
  malwareScanner: IMalwareScanner;
  imageProcessor: SharpImageProcessor;
  publicUploadBase: string | undefined;
  repoFactory: IRepositoryFactory;
  uploadValidationRepo: IUploadValidationRepository;
  emailOutboxRepo: IEmailOutboxRepository;
  payoutStatementRepo: IPayoutStatementRepository;
  profileMarketingReader: IMarketingProfileReader;
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  dataExportRepo: IDataExportJobRepository;
  newsletterSignupSyncRepo: INewsletterSignupSyncRepository;
  sourceOfFundsDocumentPurgeRepo: ISourceOfFundsDocumentPurgeRepository;
  marketingContactSyncRepo: IMarketingContactSyncRepository;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  complianceRecipientReader: IComplianceRecipientReader;
  mediaAssetProcessorRepo: IMediaAssetProcessorRepository;
  mediaAssetCleanupRepo: IMediaAssetCleanupRepository;
  qrCodeScanPersister: IQrCodeScanPersister;
  qrCodeScanPurgeRepo: IQrCodeScanPurgeRepository;
  marketingClickIdPurgeRepo: IMarketingClickIdPurgeRepository;
  marketingAttributionPurgeRepo: IMarketingAttributionPurgeRepository;
  notificationWriteRepo: INotificationWriteRepository;
  transactionRunner: ITransactionRunner;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  impersonationSweepRepo: IImpersonationSweepRepository;
  verificationPurgeRepo: IVerificationPurgeRepository;
  userPiiPurgeRepo: IUserPiiPurgeRepository;
  legalEntityArchiveCascadeReader: ILegalEntityArchiveCascadeReader;
  domainEventSink: IWorkerDomainEventSink;
  exportProviderDeps: IExportProviderDeps;
  sentryMonitorSlugs: Record<string, string>;
  heartbeat: (queue: string) => Promise<void>;
  reportWorkerJobFailure: (queue: string, job: { id?: string } | undefined, err: Error) => void;
  financeCronDispatch: import("../finance/finance-cron-dispatch.js").FinanceCronDispatchContext;
};
