import type { IMarketingProfileReader } from "@auction/marketing-events";
import type {
  INotificationWriteRepository,
  IQrCodeScanPersister,
  ITransactionRunner,
} from "@auction/persistence";
import { DrizzleTransactionRunner } from "@auction/persistence";
import {
  DrizzleNotificationWriteRepository,
  DrizzleQrCodeScanPersister,
} from "@auction/persistence/repositories";
import type { IAdminReviewTaskProjectorRepository } from "../interfaces/admin-review-task-projector.repository.js";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
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
import { DrizzleProfileMarketingReader } from "../marketing/drizzle-profile.reader.js";
import { DrizzleAdminReviewTaskProjectorRepository } from "../repositories/drizzle-admin-review-task-projector.repository.js";
import { DrizzleComplianceRecipientReader } from "../repositories/drizzle-compliance-recipient.reader.js";
import { DrizzleDataExportJobRepository } from "../repositories/drizzle-data-export.repository.js";
import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { DrizzleMarketingClickIdPurgeRepository } from "../repositories/drizzle-marketing-click-id-purge.repository.js";
import { DrizzleMarketingContactSyncRepository } from "../repositories/drizzle-marketing-contact-sync.repository.js";
import { DrizzleMarketingEventOutboxWorker } from "../repositories/drizzle-marketing-event-outbox.worker.js";
import { DrizzleMediaAssetCleanupRepository } from "../repositories/drizzle-media-asset-cleanup.repository.js";
import { DrizzleMediaAssetProcessorRepository } from "../repositories/drizzle-media-asset-processor.repository.js";
import { DrizzleNewsletterSignupSyncRepository } from "../repositories/drizzle-newsletter-signup-sync.repository.js";
import { DrizzlePayoutStatementRepository } from "../repositories/drizzle-payout-statement.repository.js";
import { DrizzleQrCodeScanPurgeRepository } from "../repositories/drizzle-qr-code-scan-purge.repository.js";
import { DrizzleSourceOfFundsDocumentPurgeRepository } from "../repositories/drizzle-source-of-funds-document-purge.repository.js";
import { DrizzleStaffOpsRecipientReader } from "../repositories/drizzle-staff-ops-recipient.reader.js";
import { DrizzleUploadValidationRepository } from "../repositories/drizzle-upload-validation.repository.js";
import type { WorkerDb } from "../workers/types.js";

export type WorkerRepositories = {
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
  notificationWriteRepo: INotificationWriteRepository;
  transactionRunner: ITransactionRunner;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
};

export function createWorkerRepositories(db: WorkerDb): WorkerRepositories {
  return {
    uploadValidationRepo: new DrizzleUploadValidationRepository(db),
    emailOutboxRepo: new DrizzleEmailOutboxRepository(db),
    payoutStatementRepo: new DrizzlePayoutStatementRepository(db),
    profileMarketingReader: new DrizzleProfileMarketingReader(db),
    marketingEventOutboxWorker: new DrizzleMarketingEventOutboxWorker(db),
    dataExportRepo: new DrizzleDataExportJobRepository(db),
    newsletterSignupSyncRepo: new DrizzleNewsletterSignupSyncRepository(db),
    sourceOfFundsDocumentPurgeRepo: new DrizzleSourceOfFundsDocumentPurgeRepository(db),
    marketingContactSyncRepo: new DrizzleMarketingContactSyncRepository(db),
    staffOpsRecipientReader: new DrizzleStaffOpsRecipientReader(db),
    complianceRecipientReader: new DrizzleComplianceRecipientReader(db),
    mediaAssetProcessorRepo: new DrizzleMediaAssetProcessorRepository(db),
    mediaAssetCleanupRepo: new DrizzleMediaAssetCleanupRepository(db),
    qrCodeScanPersister: new DrizzleQrCodeScanPersister(db),
    qrCodeScanPurgeRepo: new DrizzleQrCodeScanPurgeRepository(db),
    marketingClickIdPurgeRepo: new DrizzleMarketingClickIdPurgeRepository(db),
    notificationWriteRepo: new DrizzleNotificationWriteRepository(db),
    transactionRunner: new DrizzleTransactionRunner(db),
    adminReviewTaskProjectorRepo: new DrizzleAdminReviewTaskProjectorRepository(db),
  };
}
