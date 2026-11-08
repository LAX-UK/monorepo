import type { AlertRetentionStore } from "@auction/alerts";
import type { IMarketingProfileReader } from "@auction/marketing-events";
import type {
  ICrmRecordLinkRepository,
  IDomainEventDeliveryRepository,
  INotificationWriteRepository,
  IQrCodeScanPersister,
  IStaffRoleAssignmentReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import {
  EnsurePersonalLegalEntityService,
  type IEnsurePersonalLegalEntityService,
  MuteAwareNotificationWriter,
} from "@auction/persistence/lib";
import {
  DrizzleTransactionRunner,
  createBidAlertRetentionStores,
} from "@auction/persistence/repositories";
import {
  DrizzleCrmRecordLinkRepository,
  DrizzleDomainEventDeliveryRepository,
  DrizzleNotificationAccountMuteRepository,
  DrizzleNotificationWriteRepository,
  DrizzleQrCodeScanPersister,
  DrizzleStaffRoleAssignmentReader,
} from "@auction/persistence/repositories";
import type { IAdminImpersonationNotifyReader } from "../interfaces/admin-impersonation-notify.reader.js";
import type { IAdminReviewTaskProjectorRepository } from "../interfaces/admin-review-task-projector.repository.js";
import type { IClearArtistBlocksRepository } from "../interfaces/clear-artist-blocks.repository.js";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { ICoverAnalysisJobRepository } from "../interfaces/cover-analysis-job.repository.js";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { IDomainEventProjectorReader } from "../interfaces/domain-event-projector.reader.js";
import type { IEmailOutboxRepository } from "../interfaces/email-outbox.repository.js";
import type { IEmailAddressLookup } from "../interfaces/email-provider-suppression.js";
import type { IIdentityOutboxRelayRepository } from "../interfaces/identity-outbox-relay.repository.js";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";
import type { IKycRetentionSubjectStore } from "../interfaces/kyc-retention-subject.store.js";
import type { ILegalEntityArchiveCascadeReader } from "../interfaces/legal-entity-archive-cascade.reader.js";
import type { ILotNotifyReader } from "../interfaces/lot-notify.reader.js";
import type { IMarketingAttributionPurgeRepository } from "../interfaces/marketing-attribution-purge.repository.js";
import type { IMarketingClickIdPurgeRepository } from "../interfaces/marketing-click-id-purge.repository.js";
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
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import type { IZohoCampaignsOptOutLiftRepository } from "../interfaces/zoho-campaigns-suppression.repository.js";
import { WorkerDomainEventPublisher } from "../lib/domain-event-publisher.js";
import { WorkerDomainEventSink } from "../lib/worker-domain-event-sink.js";
import { DrizzleProfileMarketingReader } from "../marketing/drizzle-profile.reader.js";
import { DrizzleAdminImpersonationNotifyReader } from "../repositories/drizzle-admin-impersonation-notify.reader.js";
import { DrizzleAdminReviewTaskProjectorRepository } from "../repositories/drizzle-admin-review-task-projector.repository.js";
import { DrizzleClearArtistBlocksRepository } from "../repositories/drizzle-clear-artist-blocks.repository.js";
import { DrizzleComplianceRecipientReader } from "../repositories/drizzle-compliance-recipient.reader.js";
import { DrizzleCoverAnalysisJobRepository } from "../repositories/drizzle-cover-analysis-job.repository.js";
import { DrizzleDataExportJobRepository } from "../repositories/drizzle-data-export.repository.js";
import { DrizzleDomainEventProjectorReader } from "../repositories/drizzle-domain-event-projector.reader.js";
import { DrizzleEmailAddressLookup } from "../repositories/drizzle-email-address.lookup.js";
import { DrizzleEmailOutboxRepository } from "../repositories/drizzle-email-outbox.repository.js";
import { DrizzleIdentityOutboxRelayRepository } from "../repositories/drizzle-identity-outbox-relay.repository.js";
import { DrizzleImpersonationSweepRepository } from "../repositories/drizzle-impersonation-sweep.repository.js";
import { DrizzleKycRetentionLegalEntityStore } from "../repositories/drizzle-kyc-retention-legal-entity.store.js";
import { DrizzleKycRetentionPersonStore } from "../repositories/drizzle-kyc-retention-person.store.js";
import { DrizzleLegalEntityArchiveCascadeReader } from "../repositories/drizzle-legal-entity-archive-cascade.reader.js";
import { DrizzleLotNotifyReader } from "../repositories/drizzle-lot-notify.reader.js";
import { DrizzleMarketingAttributionPurgeRepository } from "../repositories/drizzle-marketing-attribution-purge.repository.js";
import { DrizzleMarketingClickIdPurgeRepository } from "../repositories/drizzle-marketing-click-id-purge.repository.js";
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
import { DrizzleZohoCampaignsSuppressionRepository } from "../repositories/drizzle-zoho-campaigns-suppression.repository.js";
import type { WorkerDb } from "../workers/types.js";

export type WorkerRepositories = {
  uploadValidationRepo: IUploadValidationRepository;
  emailOutboxRepo: IEmailOutboxRepository;
  emailAddressLookup: IEmailAddressLookup;
  payoutStatementRepo: IPayoutStatementRepository;
  profileMarketingReader: IMarketingProfileReader;
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  dataExportRepo: IDataExportJobRepository;
  staffRoleReader: IStaffRoleAssignmentReader;
  newsletterSignupSyncRepo: INewsletterSignupSyncRepository;
  kycRetentionStores: readonly IKycRetentionSubjectStore[];
  alertRetentionStores: readonly AlertRetentionStore[];
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  complianceRecipientReader: IComplianceRecipientReader;
  mediaAssetProcessorRepo: IMediaAssetProcessorRepository;
  coverAnalysisJobRepo: ICoverAnalysisJobRepository;
  mediaAssetCleanupRepo: IMediaAssetCleanupRepository;
  qrCodeScanPersister: IQrCodeScanPersister;
  qrCodeScanPurgeRepo: IQrCodeScanPurgeRepository;
  marketingClickIdPurgeRepo: IMarketingClickIdPurgeRepository;
  marketingAttributionPurgeRepo: IMarketingAttributionPurgeRepository;
  notificationWriteRepo: INotificationWriteRepository;
  transactionRunner: ITransactionRunner;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  impersonationSweepRepo: IImpersonationSweepRepository;
  identityOutboxRelayRepo: IIdentityOutboxRelayRepository;
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
  zohoCampaignsOptOutLiftRepo: IZohoCampaignsOptOutLiftRepository;
  ensurePersonalLegalEntity: IEnsurePersonalLegalEntityService;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  sourceOfFundsBuyerReader: ISourceOfFundsBuyerReader;
  sourceOfFundsDocumentsTaskRepo: ISourceOfFundsDocumentsTaskRepository;
  sourceOfFundsDocumentReviewRepo: ISourceOfFundsDocumentReviewRepository;
  sourceOfFundsReviewResolutionRepo: ISourceOfFundsReviewResolutionRepository;
  lotNotifyReader: ILotNotifyReader;
  domainEventDeliveryRepo: IDomainEventDeliveryRepository;
  crmRecordLinkRepo: ICrmRecordLinkRepository;
};

import type { WorkerEnv } from "../env.js";

export function createWorkerRepositories(
  db: WorkerDb,
  env: Pick<WorkerEnv, "DOMAIN_EVENT_PUBLISH_VALIDATE">,
): WorkerRepositories {
  const projectorStateRepo = new DrizzleProjectorStateRepository(db);
  const domainEventPublisher = new WorkerDomainEventPublisher({
    publishValidateMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  });
  return {
    uploadValidationRepo: new DrizzleUploadValidationRepository(db),
    emailOutboxRepo: new DrizzleEmailOutboxRepository(db),
    emailAddressLookup: new DrizzleEmailAddressLookup(db),
    payoutStatementRepo: new DrizzlePayoutStatementRepository(db),
    profileMarketingReader: new DrizzleProfileMarketingReader(db),
    marketingEventOutboxWorker: new DrizzleMarketingEventOutboxWorker(db),
    dataExportRepo: new DrizzleDataExportJobRepository(db),
    staffRoleReader: new DrizzleStaffRoleAssignmentReader(db),
    newsletterSignupSyncRepo: new DrizzleNewsletterSignupSyncRepository(db),
    kycRetentionStores: [
      new DrizzleKycRetentionPersonStore(db),
      new DrizzleKycRetentionLegalEntityStore(db),
    ],
    alertRetentionStores: createBidAlertRetentionStores(db),
    staffOpsRecipientReader: new DrizzleStaffOpsRecipientReader(db),
    complianceRecipientReader: new DrizzleComplianceRecipientReader(db),
    mediaAssetProcessorRepo: new DrizzleMediaAssetProcessorRepository(db),
    coverAnalysisJobRepo: new DrizzleCoverAnalysisJobRepository(db),
    mediaAssetCleanupRepo: new DrizzleMediaAssetCleanupRepository(db),
    qrCodeScanPersister: new DrizzleQrCodeScanPersister(db),
    qrCodeScanPurgeRepo: new DrizzleQrCodeScanPurgeRepository(db),
    marketingClickIdPurgeRepo: new DrizzleMarketingClickIdPurgeRepository(db),
    marketingAttributionPurgeRepo: new DrizzleMarketingAttributionPurgeRepository(db),
    // Every in-app write skips notifications about an account the recipient has muted.
    notificationWriteRepo: new MuteAwareNotificationWriter(
      new DrizzleNotificationWriteRepository(db),
      new DrizzleNotificationAccountMuteRepository(db),
    ),
    transactionRunner: new DrizzleTransactionRunner(db),
    adminReviewTaskProjectorRepo: new DrizzleAdminReviewTaskProjectorRepository(db),
    impersonationSweepRepo: new DrizzleImpersonationSweepRepository(db),
    identityOutboxRelayRepo: new DrizzleIdentityOutboxRelayRepository(db),
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
    zohoCampaignsOptOutLiftRepo: new DrizzleZohoCampaignsSuppressionRepository(db),
    ensurePersonalLegalEntity: new EnsurePersonalLegalEntityService(db),
    sourceOfFundsSettlementReader: new DrizzleSourceOfFundsSettlementReader(db),
    sourceOfFundsBuyerReader: new DrizzleSourceOfFundsBuyerReader(db),
    sourceOfFundsDocumentsTaskRepo: new DrizzleSourceOfFundsDocumentsTaskRepository(db),
    sourceOfFundsDocumentReviewRepo: new DrizzleSourceOfFundsDocumentReviewRepository(db),
    sourceOfFundsReviewResolutionRepo: new DrizzleSourceOfFundsReviewResolutionRepository(db),
    lotNotifyReader: new DrizzleLotNotifyReader(db),
    domainEventDeliveryRepo: new DrizzleDomainEventDeliveryRepository(db),
    crmRecordLinkRepo: new DrizzleCrmRecordLinkRepository(db),
  };
}
