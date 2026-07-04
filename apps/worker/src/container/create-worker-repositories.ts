import type { IMarketingProfileReader } from "@auction/marketing-events";
import type {
  INotificationWriteRepository,
  IQrCodeScanPersister,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import {
  EnsurePersonalLegalEntityService,
  type IEnsurePersonalLegalEntityService,
} from "@auction/persistence/lib";
import { DrizzleTransactionRunner } from "@auction/persistence/repositories";
import {
  DrizzleNotificationWriteRepository,
  DrizzleQrCodeScanPersister,
} from "@auction/persistence/repositories";
import type { IAdminImpersonationNotifyReader } from "../interfaces/admin-impersonation-notify.reader.js";
import type { IAdminReviewTaskProjectorRepository } from "../interfaces/admin-review-task-projector.repository.js";
import type { IClearArtistBlocksRepository } from "../interfaces/clear-artist-blocks.repository.js";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { IDomainEventProjectorReader } from "../interfaces/domain-event-projector.reader.js";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";
import type { ILegalEntityArchiveCascadeReader } from "../interfaces/legal-entity-archive-cascade.reader.js";
import type { ILotNotifyReader } from "../interfaces/lot-notify.reader.js";
import type { IMarketingClickIdPurgeRepository } from "../interfaces/marketing-click-id-purge.repository.js";
import type { IMarketingContactSyncRepository } from "../interfaces/marketing-contact-sync.repository.js";
import type { IMarketingEventOutboxWorker } from "../interfaces/marketing-event-outbox.worker.js";
import type { IMediaAssetCleanupRepository } from "../interfaces/media-asset-cleanup.repository.js";
import type { IMediaAssetProcessorRepository } from "../interfaces/media-asset-processor.repository.js";
import type { INewsletterSignupSyncRepository } from "../interfaces/newsletter-signup-sync.repository.js";
import type { INotificationFanoutReader } from "../interfaces/notification-fanout.reader.js";
import type { IPaymentRefundNotifyReader } from "../interfaces/payment-refund-notify.reader.js";
import type { IPayoutStatementRepository } from "../interfaces/payout-statement.repository.js";
import type { IPayoutTransferFailedNotifyReader } from "../interfaces/payout-transfer-failed-notify.reader.js";
import type { IProjectorFailureRecorder } from "../interfaces/projector-failure-recorder.js";
import type { IProjectorStateRepository } from "../interfaces/projector-state.repository.js";
import type { IQrCodeScanPurgeRepository } from "../interfaces/qr-code-scan-purge.repository.js";
import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";
import type {
  ISourceOfFundsBuyerReader,
  ISourceOfFundsDocumentsTaskRepository,
  ISourceOfFundsSettlementReader,
} from "../interfaces/source-of-funds-projector.repository.js";
import type {
  ISourceOfFundsDocumentReviewRepository,
  ISourceOfFundsReviewResolutionRepository,
} from "../interfaces/source-of-funds-review-projector.repository.js";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";
import type { IUploadValidationRepository } from "../interfaces/upload-validation.repository.js";
import type { IUserPiiPurgeRepository } from "../interfaces/user-pii-purge.repository.js";
import type { IVerificationPurgeRepository } from "../interfaces/verification-purge.repository.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { WorkerDomainEventPublisher } from "../lib/domain-event-publisher.js";
import { WorkerDomainEventSink } from "../lib/worker-domain-event-sink.js";
import { DrizzleProfileMarketingReader } from "../marketing/drizzle-profile.reader.js";
import { DrizzleAdminImpersonationNotifyReader } from "../repositories/drizzle-admin-impersonation-notify.reader.js";
import { DrizzleAdminReviewTaskProjectorRepository } from "../repositories/drizzle-admin-review-task-projector.repository.js";
import { DrizzleClearArtistBlocksRepository } from "../repositories/drizzle-clear-artist-blocks.repository.js";
import { DrizzleComplianceRecipientReader } from "../repositories/drizzle-compliance-recipient.reader.js";
import { DrizzleDataExportJobRepository } from "../repositories/drizzle-data-export.repository.js";
import { DrizzleDomainEventProjectorReader } from "../repositories/drizzle-domain-event-projector.reader.js";
import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { DrizzleImpersonationSweepRepository } from "../repositories/drizzle-impersonation-sweep.repository.js";
import { DrizzleLegalEntityArchiveCascadeReader } from "../repositories/drizzle-legal-entity-archive-cascade.reader.js";
import { DrizzleLotNotifyReader } from "../repositories/drizzle-lot-notify.reader.js";
import { DrizzleMarketingClickIdPurgeRepository } from "../repositories/drizzle-marketing-click-id-purge.repository.js";
import { DrizzleMarketingContactSyncRepository } from "../repositories/drizzle-marketing-contact-sync.repository.js";
import { DrizzleMarketingEventOutboxWorker } from "../repositories/drizzle-marketing-event-outbox.worker.js";
import { DrizzleMediaAssetCleanupRepository } from "../repositories/drizzle-media-asset-cleanup.repository.js";
import { DrizzleMediaAssetProcessorRepository } from "../repositories/drizzle-media-asset-processor.repository.js";
import { DrizzleNewsletterSignupSyncRepository } from "../repositories/drizzle-newsletter-signup-sync.repository.js";
import { DrizzleNotificationFanoutReader } from "../repositories/drizzle-notification-fanout.reader.js";
import { DrizzlePaymentRefundNotifyReader } from "../repositories/drizzle-payment-refund-notify.reader.js";
import { DrizzlePayoutStatementRepository } from "../repositories/drizzle-payout-statement.repository.js";
import { DrizzlePayoutTransferFailedNotifyReader } from "../repositories/drizzle-payout-transfer-failed-notify.reader.js";
import { DrizzleProjectorFailureRecorder } from "../repositories/drizzle-projector-failure-recorder.js";
import { DrizzleProjectorStateRepository } from "../repositories/drizzle-projector-state.repository.js";
import { DrizzleQrCodeScanPurgeRepository } from "../repositories/drizzle-qr-code-scan-purge.repository.js";
import { DrizzleSourceOfFundsDocumentPurgeRepository } from "../repositories/drizzle-source-of-funds-document-purge.repository.js";
import {
  DrizzleSourceOfFundsBuyerReader,
  DrizzleSourceOfFundsDocumentsTaskRepository,
  DrizzleSourceOfFundsSettlementReader,
} from "../repositories/drizzle-source-of-funds-projector.repository.js";
import {
  DrizzleSourceOfFundsDocumentReviewRepository,
  DrizzleSourceOfFundsReviewResolutionRepository,
} from "../repositories/drizzle-source-of-funds-review-projector.repository.js";
import { DrizzleStaffOpsRecipientReader } from "../repositories/drizzle-staff-ops-recipient.reader.js";
import { DrizzleUploadValidationRepository } from "../repositories/drizzle-upload-validation.repository.js";
import { DrizzleUserPiiPurgeRepository } from "../repositories/drizzle-user-pii-purge.repository.js";
import { DrizzleVerificationPurgeRepository } from "../repositories/drizzle-verification-purge.repository.js";
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
  impersonationSweepRepo: IImpersonationSweepRepository;
  verificationPurgeRepo: IVerificationPurgeRepository;
  userPiiPurgeRepo: IUserPiiPurgeRepository;
  legalEntityArchiveCascadeReader: ILegalEntityArchiveCascadeReader;
  domainEventSink: IWorkerDomainEventSink;
  projectorStateRepo: IProjectorStateRepository;
  domainEventReader: IDomainEventProjectorReader;
  projectorFailureRecorder: IProjectorFailureRecorder;
  notificationFanoutReader: INotificationFanoutReader;
  adminImpersonationNotifyReader: IAdminImpersonationNotifyReader;
  paymentRefundNotifyReader: IPaymentRefundNotifyReader;
  payoutTransferFailedNotifyReader: IPayoutTransferFailedNotifyReader;
  clearArtistBlocksRepo: IClearArtistBlocksRepository;
  ensurePersonalLegalEntity: IEnsurePersonalLegalEntityService;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  sourceOfFundsBuyerReader: ISourceOfFundsBuyerReader;
  sourceOfFundsDocumentsTaskRepo: ISourceOfFundsDocumentsTaskRepository;
  sourceOfFundsDocumentReviewRepo: ISourceOfFundsDocumentReviewRepository;
  sourceOfFundsReviewResolutionRepo: ISourceOfFundsReviewResolutionRepository;
  lotNotifyReader: ILotNotifyReader;
};

export function createWorkerRepositories(db: WorkerDb): WorkerRepositories {
  const projectorStateRepo = new DrizzleProjectorStateRepository(db);
  const domainEventPublisher = new WorkerDomainEventPublisher();
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
    impersonationSweepRepo: new DrizzleImpersonationSweepRepository(db),
    verificationPurgeRepo: new DrizzleVerificationPurgeRepository(db),
    userPiiPurgeRepo: new DrizzleUserPiiPurgeRepository(db),
    legalEntityArchiveCascadeReader: new DrizzleLegalEntityArchiveCascadeReader(db),
    domainEventSink: new WorkerDomainEventSink(domainEventPublisher, db),
    projectorStateRepo,
    domainEventReader: new DrizzleDomainEventProjectorReader(db),
    projectorFailureRecorder: new DrizzleProjectorFailureRecorder(db, projectorStateRepo),
    notificationFanoutReader: new DrizzleNotificationFanoutReader(db),
    adminImpersonationNotifyReader: new DrizzleAdminImpersonationNotifyReader(db),
    paymentRefundNotifyReader: new DrizzlePaymentRefundNotifyReader(db),
    payoutTransferFailedNotifyReader: new DrizzlePayoutTransferFailedNotifyReader(db),
    clearArtistBlocksRepo: new DrizzleClearArtistBlocksRepository(db),
    ensurePersonalLegalEntity: new EnsurePersonalLegalEntityService(db),
    sourceOfFundsSettlementReader: new DrizzleSourceOfFundsSettlementReader(db),
    sourceOfFundsBuyerReader: new DrizzleSourceOfFundsBuyerReader(db),
    sourceOfFundsDocumentsTaskRepo: new DrizzleSourceOfFundsDocumentsTaskRepository(db),
    sourceOfFundsDocumentReviewRepo: new DrizzleSourceOfFundsDocumentReviewRepository(db),
    sourceOfFundsReviewResolutionRepo: new DrizzleSourceOfFundsReviewResolutionRepository(db),
    lotNotifyReader: new DrizzleLotNotifyReader(db),
  };
}
