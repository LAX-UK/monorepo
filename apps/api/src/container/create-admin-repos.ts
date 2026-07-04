import type { Database } from "@auction/db";
import type {
  IAdminDisputeCaseEnrichmentReader,
  IAdminDomainEventReader,
  IAdminFinanceIssueSnapshotReader,
  IAdminLegalEntityBrowseReader,
  IAdminLotBrowseReader,
  IAdminManualReviewPaymentEnrichmentReader,
  IAdminManualReviewPaymentReader,
  IAdminMarketingEventOutboxRepository,
  IAdminOnboardingIssuesReader,
  IAdminReviewTaskReader,
  IAdminReviewTaskRepository,
  IAdminSaleOperationsSnapshotReader,
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserKycReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IFailedJobRepository,
  ILegalEntityDocumentAdminRepository,
  ILegalEntityLifecycleAdminRepository,
  IUserEmailVerifiedPublisher,
  IUserMetricsReader,
} from "@auction/persistence/interfaces";
import {
  DrizzleAdminDisputeCaseEnrichmentReader,
  DrizzleAdminDomainEventReader,
  DrizzleAdminFinanceIssueSnapshotReader,
  DrizzleAdminLegalEntityBrowseReader,
  DrizzleAdminLotBrowseReader,
  DrizzleAdminManualReviewPaymentEnrichmentReader,
  DrizzleAdminManualReviewPaymentReader,
  DrizzleAdminMarketingEventOutboxRepository,
  DrizzleAdminOnboardingIssuesReader,
  DrizzleAdminReviewTaskReader,
  DrizzleAdminReviewTaskRepository,
  DrizzleAdminSaleOperationsSnapshotReader,
  DrizzleAdminUserActivityReader,
  DrizzleAdminUserBidsReader,
  DrizzleAdminUserKycReader,
  DrizzleAdminUserReader,
  DrizzleAdminUserRoleManager,
  DrizzleFailedJobRepository,
  DrizzleLegalEntityDocumentAdminRepository,
  DrizzleLegalEntityLifecycleAdminRepository,
  DrizzleUserEmailVerifiedPublisher,
  DrizzleUserMetricsReader,
} from "@auction/persistence/repositories";

export type AdminRepositories = {
  userMetrics: IUserMetricsReader;
  adminUserReader: IAdminUserReader;
  adminUserKycReader: IAdminUserKycReader;
  adminRoleManager: IAdminUserRoleManager;
  adminActivityReader: IAdminUserActivityReader;
  adminUserBidsReader: IAdminUserBidsReader;
  adminSaleOperationsSnapshotReader: IAdminSaleOperationsSnapshotReader;
  adminLotBrowseReader: IAdminLotBrowseReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
  adminOnboardingIssuesReader: IAdminOnboardingIssuesReader;
  adminReviewTaskReader: IAdminReviewTaskReader;
  adminReviewTaskRepository: IAdminReviewTaskRepository;
  adminLegalEntityBrowseReader: IAdminLegalEntityBrowseReader;
  adminManualReviewPaymentReader: IAdminManualReviewPaymentReader;
  adminManualReviewPaymentEnrichmentReader: IAdminManualReviewPaymentEnrichmentReader;
  adminDomainEventReader: IAdminDomainEventReader;
  adminDisputeCaseEnrichmentReader: IAdminDisputeCaseEnrichmentReader;
  legalEntityLifecycleAdminRepository: ILegalEntityLifecycleAdminRepository;
  legalEntityDocumentAdminRepository: ILegalEntityDocumentAdminRepository;
  adminMarketingEventOutboxRepository: IAdminMarketingEventOutboxRepository;
  failedJobRepository: IFailedJobRepository;
  userEmailVerifiedPublisher: IUserEmailVerifiedPublisher;
};

export function createAdminRepositories(db: Database): AdminRepositories {
  const userMetrics = new DrizzleUserMetricsReader(db);
  const adminUserReader = new DrizzleAdminUserReader(db);
  const adminUserKycReader = new DrizzleAdminUserKycReader(db);
  const adminRoleManager = new DrizzleAdminUserRoleManager(db);
  const adminActivityReader = new DrizzleAdminUserActivityReader(db);
  const adminUserBidsReader = new DrizzleAdminUserBidsReader(db);
  const adminSaleOperationsSnapshotReader = new DrizzleAdminSaleOperationsSnapshotReader(db);
  const adminLotBrowseReader = new DrizzleAdminLotBrowseReader(db);
  const adminFinanceIssueSnapshotReader = new DrizzleAdminFinanceIssueSnapshotReader(db);
  const adminOnboardingIssuesReader = new DrizzleAdminOnboardingIssuesReader(db);
  const adminReviewTaskReader = new DrizzleAdminReviewTaskReader(db);
  const adminReviewTaskRepository = new DrizzleAdminReviewTaskRepository(db);
  const adminLegalEntityBrowseReader = new DrizzleAdminLegalEntityBrowseReader(db);
  const adminManualReviewPaymentReader = new DrizzleAdminManualReviewPaymentReader(db);
  const adminManualReviewPaymentEnrichmentReader =
    new DrizzleAdminManualReviewPaymentEnrichmentReader(db);
  const adminDomainEventReader = new DrizzleAdminDomainEventReader(db);
  const adminDisputeCaseEnrichmentReader = new DrizzleAdminDisputeCaseEnrichmentReader(db);
  const legalEntityLifecycleAdminRepository = new DrizzleLegalEntityLifecycleAdminRepository(db);
  const legalEntityDocumentAdminRepository = new DrizzleLegalEntityDocumentAdminRepository(db);
  const adminMarketingEventOutboxRepository = new DrizzleAdminMarketingEventOutboxRepository(db);
  const failedJobRepository = new DrizzleFailedJobRepository(db);
  const userEmailVerifiedPublisher = new DrizzleUserEmailVerifiedPublisher(db);

  return {
    userMetrics,
    adminUserReader,
    adminUserKycReader,
    adminRoleManager,
    adminActivityReader,
    adminUserBidsReader,
    adminSaleOperationsSnapshotReader,
    adminLotBrowseReader,
    adminFinanceIssueSnapshotReader,
    adminOnboardingIssuesReader,
    adminReviewTaskReader,
    adminReviewTaskRepository,
    adminLegalEntityBrowseReader,
    adminManualReviewPaymentReader,
    adminManualReviewPaymentEnrichmentReader,
    adminDomainEventReader,
    adminDisputeCaseEnrichmentReader,
    legalEntityLifecycleAdminRepository,
    legalEntityDocumentAdminRepository,
    adminMarketingEventOutboxRepository,
    failedJobRepository,
    userEmailVerifiedPublisher,
  };
}
