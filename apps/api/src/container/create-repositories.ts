import type { Database } from "@auction/db";
import {
  DrizzleAbsenteeBidRepository,
  DrizzleAccountDeletionEligibilityReader,
  DrizzleAddressRepository,
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
  DrizzleAmlHoldStore,
  DrizzleAmlScreeningRepository,
  DrizzleAntiShillingRepository,
  DrizzleArtistWatchlistRepository,
  DrizzleCategoryRepository,
  DrizzleConditionReportRequestRepository,
  DrizzleConnectTransferRepository,
  DrizzleDisplayPairingRepository,
  DrizzleEmailObservabilityRepository,
  DrizzleEmailSuppressionRepository,
  DrizzleEmailWebhookIngestRepository,
  DrizzleFailedJobRepository,
  DrizzleImpersonationSessionRepository,
  DrizzleInvitationRepository,
  DrizzleKycRepository,
  DrizzleLegalEntityConnectRepository,
  DrizzleLegalEntityDocumentAdminRepository,
  DrizzleLegalEntityLifecycleAdminRepository,
  DrizzleLegalEntityMemberRepository,
  DrizzleLegalEntityNotificationRecipientRepository,
  DrizzleLegalEntityOnboardingRepository,
  DrizzleLotDocumentRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleLotLifecycleTimelineReader,
  DrizzleLotMetricsReader,
  DrizzleMediaAssetReader,
  DrizzleNewsletterSignupRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleNotificationPreferenceRepository,
  DrizzleNotificationReadRepository,
  DrizzleNotificationWriteRepository,
  DrizzleOnsiteEventCheckInLogRepository,
  DrizzleOnsiteEventClientReader,
  DrizzleOnsiteEventRepository,
  DrizzleOnsiteEventRsvpRepository,
  DrizzlePaddleRepository,
  DrizzlePaymentExternalRefRepository,
  DrizzlePaymentMetricsReader,
  DrizzlePaymentRefundReconcileRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzlePendingInvitationsReader,
  DrizzlePlatformCatalogLegalEntityReader,
  DrizzleProfileRepository,
  DrizzlePushSubscriptionRepository,
  DrizzleQrCodeAnalyticsReader,
  DrizzleQrCodeRepository,
  DrizzleQrCodeScanPersister,
  DrizzleRepositoryFactory,
  DrizzleSaleBiddersReader,
  DrizzleSaleDocumentRepository,
  DrizzleSaleExpectedGuestsReader,
  DrizzleSaleFollowRepository,
  DrizzleSaleModeLookup,
  DrizzleSaleRegistrationRepository,
  DrizzleSaleroomCheckInRepository,
  DrizzleSaleroomDisplaySessionRepository,
  DrizzleSaleroomLiveSessionCounter,
  DrizzleSaleroomOnBlockReader,
  DrizzleSaleroomSessionLookup,
  DrizzleSavedSearchRepository,
  DrizzleSourceOfFundsDocumentRepository,
  DrizzleSourceOfFundsDocumentReviewRepository,
  DrizzleSourceOfFundsRepository,
  DrizzleSourceOfFundsSettlementReader,
  DrizzleSubmissionDocumentRepository,
  DrizzleUiPreferenceRepository,
  DrizzleUploadObjectReader,
  DrizzleUploadPersistenceRepository,
  DrizzleUserEmailChangeRepository,
  DrizzleUserEmailVerifiedPublisher,
  DrizzleUserInvitationRepository,
  DrizzleUserMetricsReader,
  DrizzleUserRepository,
  DrizzleUserSuspensionChecker,
  DrizzleVenueRepository,
  DrizzleWatchlistRepository,
  DrizzleWebhookEventRepository,
  DrizzleXeroConnectionRepository,
  DrizzleXeroWebhookEventRepository,
  type IAbsenteeBidRepository,
  type IAccountDeletionEligibilityReader,
  type IAddressRepository,
  type IAdminDisputeCaseEnrichmentReader,
  type IAdminDomainEventReader,
  type IAdminFinanceIssueSnapshotReader,
  type IAdminMarketingEventOutboxRepository,
  type IAdminSaleOperationsSnapshotReader,
  type IAdminUserActivityReader,
  type IAdminUserBidsReader,
  type IAdminUserKycReader,
  type IAdminUserReader,
  type IAdminUserRoleManager,
  type IAmlHoldStore,
  type IAntiShillingGuard,
  type IArtistWatchlistRepository,
  type ICategoryRepository,
  type IConditionReportRequestRepository,
  type IConnectTransferRepository,
  type IDisplayPairingRepository,
  type IEmailObservabilityRepository,
  type IEmailSuppressionRepository,
  type IEmailWebhookIngestRepository,
  type IImpersonationSessionRepository,
  type IKycRepository,
  type ILegalEntityConnectReader,
  type ILegalEntityConnectRepository,
  type ILegalEntityDocumentAdminRepository,
  type ILegalEntityLifecycleAdminRepository,
  type ILegalEntityMemberRepository,
  type ILegalEntityNotificationRecipientReader,
  type ILegalEntityOnboardingRepository,
  type ILegalEntityRepository,
  type ILotDocumentRepository,
  type ILotLifecycleSnapshotReader,
  type ILotLifecycleSnapshotRepository,
  type ILotLifecycleTimelineReader,
  type ILotMetricsReader,
  type INewsletterSignupRepository,
  type INotificationOutboxRepository,
  type INotificationPreferenceRepository,
  type INotificationReadRepository,
  type INotificationWriteRepository,
  type IOnsiteEventCheckInLogRepository,
  type IOnsiteEventClientReader,
  type IOnsiteEventRepository,
  type IOnsiteEventRsvpRepository,
  type IPaddleRepository,
  type IPaymentExternalRefRepository,
  type IPaymentMetricsReader,
  type IPaymentRefundReconcileRepository,
  type IPaymentWriteRepository,
  type IPayoutRepository,
  type IPendingInvitationsReader,
  type IProfileReader,
  type IProfileWriter,
  type IPushSubscriptionRepository,
  type IQrCodeAnalyticsReader,
  type IQrCodeRepository,
  type ISaleBiddersReader,
  type ISaleDocumentRepository,
  type ISaleExpectedGuestsReader,
  type ISaleFollowRepository,
  type ISaleModeLookup,
  type ISaleRegistrationRepository,
  type ISaleroomCheckInRepository,
  type ISaleroomDisplaySessionRepository,
  type ISaleroomSessionLookup,
  type ISavedSearchRepository,
  type ISourceOfFundsDocumentRepository,
  type ISourceOfFundsDocumentReviewRepository,
  type ISourceOfFundsRepository,
  type ISourceOfFundsSettlementReader,
  type ISubmissionDocumentRepository,
  type IUiPreferenceRepository,
  type IUploadObjectReader,
  type IUploadPersistenceRepository,
  type IUserEmailChangeRepository,
  type IUserInvitationRepository,
  type IUserMetricsReader,
  type IUserRepository,
  type IUserSuspensionChecker,
  type IVenueRepository,
  type IWatchlistRepository,
  type IWatchlistScreeningReader,
  type IWatchlistScreeningWriter,
  type IWebhookEventRepository,
  type IXeroConnectionRepository,
  type IXeroWebhookEventRepository,
  createDrizzleLegalEntityRepository,
} from "@auction/persistence";
import {
  DrizzleTelephoneBidBookingRepository,
  type ITelephoneBidBookingRepository,
} from "@auction/persistence";
import {
  DrizzleArtistRegistryRepository,
  type IAdminLegalEntityBrowseReader,
  type IAdminLotBrowseReader,
  type IAdminManualReviewPaymentEnrichmentReader,
  type IAdminManualReviewPaymentReader,
  type IAdminOnboardingIssuesReader,
  type IAdminReviewTaskReader,
  type IAdminReviewTaskRepository,
  type IArtistDeleteGuards,
  type IArtistDeleteRepository,
  type IArtistProfileAdminReader,
  type IArtistProfileCommandRepository,
  type IArtistProfileDirectoryReader,
  type IArtistRegistryRepository,
  type IFailedJobRepository,
  type IMediaAssetReader,
  type IPaymentWebhookLookupReader,
  type IPlatformCatalogLegalEntityReader,
  type IQrCodeScanPersister,
  type ISaleroomLiveSessionCounter,
  type ISaleroomOnBlockReader,
  type IUserEmailVerifiedPublisher,
  createDrizzleArtistProfileRepository,
} from "@auction/persistence";
import {
  DrizzleAttentionFeedReader,
  DrizzleImpersonationDomainEventReader,
  DrizzleSaleroomDisplaySnapshotReader,
  type IAttentionFeedReader,
  type IImpersonationDomainEventReader,
  type ISaleroomDisplaySnapshotReader,
} from "@auction/persistence";
import type { IEntityInvitationRepository } from "@auction/persistence";
import type { IItemSubmissionRepository } from "@auction/persistence";
import type { ISaleRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";

export type IArtistProfileRepository = IArtistProfileDirectoryReader &
  IArtistProfileAdminReader &
  IArtistProfileCommandRepository &
  IArtistDeleteGuards &
  IArtistDeleteRepository;

export type IAmlScreeningRepository = IWatchlistScreeningReader & IWatchlistScreeningWriter;

export type IProfileRepository = IProfileReader & IProfileWriter;

/** Drizzle repositories and readers constructed from a single `Database` connection. */
export type ContainerRepositories = {
  repoFactory: IRepositoryFactory;
  lotRepo: ReturnType<IRepositoryFactory["forConnection"]>["lot"];
  saleRepo: ISaleRepository;
  userRepo: IUserRepository;
  userEmailChangeRepository: IUserEmailChangeRepository;
  itemSubmissionRepository: IItemSubmissionRepository;
  saleRegistrationRepository: ISaleRegistrationRepository;
  conditionReportRequestRepository: IConditionReportRequestRepository;
  qrCodeRepository: IQrCodeRepository;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityOnboardingRepository: ILegalEntityOnboardingRepository;
  legalEntityConnectRepository: ILegalEntityConnectRepository;
  legalEntityConnectReader: ILegalEntityConnectReader;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  kycRepository: IKycRepository;
  pendingInvitationsReader: IPendingInvitationsReader;
  payoutRepository: IPayoutRepository;
  connectTransferRepository: IConnectTransferRepository;
  categoryRepo: ICategoryRepository;
  venueRepo: IVenueRepository;
  watchlistRepo: IWatchlistRepository;
  artistWatchlistRepo: IArtistWatchlistRepository;
  notificationReadRepo: INotificationReadRepository;
  notificationWriteRepo: INotificationWriteRepository;
  paymentRepo: IPaymentWriteRepository;
  paymentRefundReconcileRepository: IPaymentRefundReconcileRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceRepository: IUiPreferenceRepository;
  emailObservabilityRepository: IEmailObservabilityRepository;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  profileRepo: IProfileRepository;
  addressRepo: IAddressRepository;
  antiShillingGuard: IAntiShillingGuard;
  notificationOutboxRepository: INotificationOutboxRepository;
  saleroomSessionLookup: ISaleroomSessionLookup;
  amlScreeningRepository: IAmlScreeningRepository;
  amlHoldStore: IAmlHoldStore;
  sourceOfFundsRepository: ISourceOfFundsRepository;
  sourceOfFundsDocumentRepository: ISourceOfFundsDocumentRepository;
  sourceOfFundsDocumentReviewRepository: ISourceOfFundsDocumentReviewRepository;
  sourceOfFundsSettlementReader: ISourceOfFundsSettlementReader;
  lotLifecycleSnapshotRepository: ILotLifecycleSnapshotRepository;
  lotLifecycleSnapshotReader: ILotLifecycleSnapshotReader;
  lotLifecycleTimelineReader: ILotLifecycleTimelineReader;
  lotDocumentRepo: ILotDocumentRepository;
  saleDocumentRepo: ISaleDocumentRepository;
  submissionDocumentRepo: ISubmissionDocumentRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  telephoneBidBookingRepo: ITelephoneBidBookingRepository;
  paddleRepo: IPaddleRepository;
  saleroomCheckInRepo: ISaleroomCheckInRepository;
  saleExpectedGuestsReader: ISaleExpectedGuestsReader;
  onsiteEventRepo: IOnsiteEventRepository;
  onsiteEventRsvpRepo: IOnsiteEventRsvpRepository;
  onsiteEventCheckInLogRepo: IOnsiteEventCheckInLogRepository;
  onsiteEventClientReader: IOnsiteEventClientReader;
  saleFollowRepo: ISaleFollowRepository;
  artistProfileRepo: IArtistProfileRepository;
  artistRegistryRepository: IArtistRegistryRepository;
  xeroConnRepo: IXeroConnectionRepository;
  paymentExtRepo: IPaymentExternalRefRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  displayPairingRepository: IDisplayPairingRepository;
  invitationRepository: IUserInvitationRepository;
  entityInvitationRepository: IEntityInvitationRepository;
  saleModeLookup: ISaleModeLookup;
  lotMetrics: ILotMetricsReader;
  paymentMetrics: IPaymentMetricsReader;
  userMetrics: IUserMetricsReader;
  adminUserReader: IAdminUserReader;
  adminUserKycReader: IAdminUserKycReader;
  adminRoleManager: IAdminUserRoleManager;
  adminActivityReader: IAdminUserActivityReader;
  adminUserBidsReader: IAdminUserBidsReader;
  attentionFeedReader: IAttentionFeedReader;
  saleroomDisplaySessionRepository: ISaleroomDisplaySessionRepository;
  impersonationSessionRepository: IImpersonationSessionRepository;
  impersonationDomainEventReader: IImpersonationDomainEventReader;
  saleBiddersReader: ISaleBiddersReader;
  userSuspensionChecker: IUserSuspensionChecker;
  saleroomDisplaySnapshotReader: ISaleroomDisplaySnapshotReader;
  adminSaleOperationsSnapshotReader: IAdminSaleOperationsSnapshotReader;
  adminLotBrowseReader: IAdminLotBrowseReader;
  qrCodeAnalyticsReader: IQrCodeAnalyticsReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
  adminOnboardingIssuesReader: IAdminOnboardingIssuesReader;
  adminReviewTaskReader: IAdminReviewTaskReader;
  adminReviewTaskRepository: IAdminReviewTaskRepository;
  mediaAssetReader: IMediaAssetReader;
  qrCodeScanPersister: IQrCodeScanPersister;
  saleroomOnBlockReader: ISaleroomOnBlockReader;
  platformCatalogLegalEntityReader: IPlatformCatalogLegalEntityReader;
  paymentWebhookLookupReader: IPaymentWebhookLookupReader;
  failedJobRepository: IFailedJobRepository;
  saleroomLiveSessionCounter: ISaleroomLiveSessionCounter;
  userEmailVerifiedPublisher: IUserEmailVerifiedPublisher;
  adminLegalEntityBrowseReader: IAdminLegalEntityBrowseReader;
  adminManualReviewPaymentReader: IAdminManualReviewPaymentReader;
  adminManualReviewPaymentEnrichmentReader: IAdminManualReviewPaymentEnrichmentReader;
  adminDomainEventReader: IAdminDomainEventReader;
  adminDisputeCaseEnrichmentReader: IAdminDisputeCaseEnrichmentReader;
  legalEntityLifecycleAdminRepository: ILegalEntityLifecycleAdminRepository;
  legalEntityMemberRepository: ILegalEntityMemberRepository;
  absenteeBidRepository: IAbsenteeBidRepository;
  accountDeletionEligibilityReader: IAccountDeletionEligibilityReader;
  savedSearchRepository: ISavedSearchRepository;
  emailSuppressionRepository: IEmailSuppressionRepository;
  emailWebhookIngestRepository: IEmailWebhookIngestRepository;
  uploadObjectReader: IUploadObjectReader;
  adminMarketingEventOutboxRepository: IAdminMarketingEventOutboxRepository;
  legalEntityDocumentAdminRepository: ILegalEntityDocumentAdminRepository;
  newsletterSignupRepository: INewsletterSignupRepository;
  webhookEventRepository: IWebhookEventRepository;
};

export function createRepositories(db: Database): ContainerRepositories {
  const repoFactory: IRepositoryFactory = new DrizzleRepositoryFactory(db);
  const lotRepo = repoFactory.root.lot;
  const { sale: saleRepo, itemSubmission: itemSubmissionRepository } =
    repoFactory.forTransaction(db);
  const saleRegistrationRepository = new DrizzleSaleRegistrationRepository(db);
  const conditionReportRequestRepository = new DrizzleConditionReportRequestRepository(db);
  const qrCodeRepository = new DrizzleQrCodeRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const userEmailChangeRepository = new DrizzleUserEmailChangeRepository(db);
  const legalEntityRepository = createDrizzleLegalEntityRepository(db);
  const legalEntityOnboardingRepository = new DrizzleLegalEntityOnboardingRepository(db);
  const legalEntityConnectRepository = new DrizzleLegalEntityConnectRepository(db);
  const legalEntityConnectReader = legalEntityConnectRepository;
  const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader =
    new DrizzleLegalEntityNotificationRecipientRepository(db);
  const kycRepository = new DrizzleKycRepository(db);
  const pendingInvitationsReader: IPendingInvitationsReader = new DrizzlePendingInvitationsReader(
    db,
  );
  const payoutRepository: IPayoutRepository = new DrizzlePayoutRepository(db);
  const connectTransferRepository: IConnectTransferRepository =
    new DrizzleConnectTransferRepository(db);
  const categoryRepo = new DrizzleCategoryRepository(db);
  const venueRepo = new DrizzleVenueRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const artistWatchlistRepo = new DrizzleArtistWatchlistRepository(db);
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const notificationWriteRepo = new DrizzleNotificationWriteRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const paymentRefundReconcileRepository = new DrizzlePaymentRefundReconcileRepository(db);
  const notificationPreferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  const uiPreferenceRepository = new DrizzleUiPreferenceRepository(db);
  const emailObservabilityRepository = new DrizzleEmailObservabilityRepository(db);
  const pushSubscriptionRepository = new DrizzlePushSubscriptionRepository(db);
  const profileRepo = new DrizzleProfileRepository(db);
  const addressRepo = new DrizzleAddressRepository(db);
  const antiShillingGuard: IAntiShillingGuard = new DrizzleAntiShillingRepository(db);
  const notificationOutboxRepository = new DrizzleNotificationOutboxRepository(db);
  const saleroomSessionLookup = new DrizzleSaleroomSessionLookup(db);
  const amlScreeningRepository = new DrizzleAmlScreeningRepository(db);
  const amlHoldStore = new DrizzleAmlHoldStore(db);
  const sourceOfFundsRepository = new DrizzleSourceOfFundsRepository(db);
  const sourceOfFundsDocumentRepository = new DrizzleSourceOfFundsDocumentRepository(db);
  const sourceOfFundsDocumentReviewRepository = new DrizzleSourceOfFundsDocumentReviewRepository(
    db,
  );
  const sourceOfFundsSettlementReader = new DrizzleSourceOfFundsSettlementReader(db);
  const lotLifecycleSnapshotRepository = new DrizzleLotLifecycleSnapshotRepository(db);
  const lotLifecycleSnapshotReader = lotLifecycleSnapshotRepository;
  const lotLifecycleTimelineReader = new DrizzleLotLifecycleTimelineReader(db);
  const lotDocumentRepo = new DrizzleLotDocumentRepository(db);
  const saleDocumentRepo = new DrizzleSaleDocumentRepository(db);
  const submissionDocumentRepo = new DrizzleSubmissionDocumentRepository(db);
  const uploadPersistenceRepository = new DrizzleUploadPersistenceRepository(db);
  const telephoneBidBookingRepo = new DrizzleTelephoneBidBookingRepository(db);
  const paddleRepo = new DrizzlePaddleRepository(db);
  const saleroomCheckInRepo = new DrizzleSaleroomCheckInRepository(db);
  const saleExpectedGuestsReader = new DrizzleSaleExpectedGuestsReader(db);
  const onsiteEventRepo = new DrizzleOnsiteEventRepository(db);
  const onsiteEventRsvpRepo = new DrizzleOnsiteEventRsvpRepository(db);
  const onsiteEventCheckInLogRepo = new DrizzleOnsiteEventCheckInLogRepository(db);
  const onsiteEventClientReader = new DrizzleOnsiteEventClientReader(db);
  const saleFollowRepo = new DrizzleSaleFollowRepository(db);
  const artistProfileRepo = createDrizzleArtistProfileRepository(db);
  const artistRegistryRepository = new DrizzleArtistRegistryRepository(db);
  const xeroConnRepo = new DrizzleXeroConnectionRepository(db);
  const paymentExtRepo = new DrizzlePaymentExternalRefRepository(db);
  const xeroWebhookEventRepository = new DrizzleXeroWebhookEventRepository(db);
  const displayPairingRepository = new DrizzleDisplayPairingRepository(db);
  const invitationRepository = new DrizzleUserInvitationRepository(db);
  const entityInvitationRepository = new DrizzleInvitationRepository(db);
  const saleModeLookup = new DrizzleSaleModeLookup(db);
  const lotMetrics = new DrizzleLotMetricsReader(db);
  const paymentMetrics = new DrizzlePaymentMetricsReader(db);
  const userMetrics = new DrizzleUserMetricsReader(db);
  const adminUserReader = new DrizzleAdminUserReader(db);
  const adminUserKycReader = new DrizzleAdminUserKycReader(db);
  const adminRoleManager = new DrizzleAdminUserRoleManager(db);
  const adminActivityReader = new DrizzleAdminUserActivityReader(db);
  const adminUserBidsReader = new DrizzleAdminUserBidsReader(db);
  const attentionFeedReader = new DrizzleAttentionFeedReader(db);
  const saleroomDisplaySessionRepository = new DrizzleSaleroomDisplaySessionRepository(db);
  const impersonationSessionRepository = new DrizzleImpersonationSessionRepository(db);
  const impersonationDomainEventReader = new DrizzleImpersonationDomainEventReader(db);
  const saleBiddersReader = new DrizzleSaleBiddersReader(db);
  const userSuspensionChecker = new DrizzleUserSuspensionChecker(db);
  const saleroomDisplaySnapshotReader = new DrizzleSaleroomDisplaySnapshotReader(db);
  const adminSaleOperationsSnapshotReader = new DrizzleAdminSaleOperationsSnapshotReader(db);
  const adminLotBrowseReader = new DrizzleAdminLotBrowseReader(db);
  const qrCodeAnalyticsReader = new DrizzleQrCodeAnalyticsReader(db);
  const adminFinanceIssueSnapshotReader = new DrizzleAdminFinanceIssueSnapshotReader(db);
  const adminOnboardingIssuesReader = new DrizzleAdminOnboardingIssuesReader(db);
  const adminReviewTaskReader = new DrizzleAdminReviewTaskReader(db);
  const adminReviewTaskRepository = new DrizzleAdminReviewTaskRepository(db);
  const mediaAssetReader = new DrizzleMediaAssetReader(db);
  const qrCodeScanPersister = new DrizzleQrCodeScanPersister(db);
  const saleroomOnBlockReader = new DrizzleSaleroomOnBlockReader(db);
  const platformCatalogLegalEntityReader = new DrizzlePlatformCatalogLegalEntityReader(db);
  const paymentWebhookLookupReader = new DrizzlePaymentWebhookLookupReader(db);
  const failedJobRepository = new DrizzleFailedJobRepository(db);
  const saleroomLiveSessionCounter = new DrizzleSaleroomLiveSessionCounter(db);
  const userEmailVerifiedPublisher = new DrizzleUserEmailVerifiedPublisher(db);
  const adminLegalEntityBrowseReader = new DrizzleAdminLegalEntityBrowseReader(db);
  const adminManualReviewPaymentReader = new DrizzleAdminManualReviewPaymentReader(db);
  const adminManualReviewPaymentEnrichmentReader =
    new DrizzleAdminManualReviewPaymentEnrichmentReader(db);
  const adminDomainEventReader = new DrizzleAdminDomainEventReader(db);
  const adminDisputeCaseEnrichmentReader = new DrizzleAdminDisputeCaseEnrichmentReader(db);
  const legalEntityLifecycleAdminRepository = new DrizzleLegalEntityLifecycleAdminRepository(db);
  const legalEntityMemberRepository = new DrizzleLegalEntityMemberRepository(db);
  const absenteeBidRepository = new DrizzleAbsenteeBidRepository(db);
  const accountDeletionEligibilityReader = new DrizzleAccountDeletionEligibilityReader(db);
  const savedSearchRepository = new DrizzleSavedSearchRepository(db);
  const emailSuppressionRepository = new DrizzleEmailSuppressionRepository(db);
  const emailWebhookIngestRepository = new DrizzleEmailWebhookIngestRepository(db);
  const uploadObjectReader = new DrizzleUploadObjectReader(db);
  const adminMarketingEventOutboxRepository = new DrizzleAdminMarketingEventOutboxRepository(db);
  const legalEntityDocumentAdminRepository = new DrizzleLegalEntityDocumentAdminRepository(db);
  const newsletterSignupRepository = new DrizzleNewsletterSignupRepository(db);
  const webhookEventRepository = new DrizzleWebhookEventRepository(db);

  return {
    repoFactory,
    lotRepo,
    saleRepo,
    userRepo,
    userEmailChangeRepository,
    itemSubmissionRepository,
    saleRegistrationRepository,
    conditionReportRequestRepository,
    qrCodeRepository,
    legalEntityRepository,
    legalEntityOnboardingRepository,
    legalEntityConnectRepository,
    legalEntityConnectReader,
    legalEntityNotificationRecipients,
    kycRepository,
    pendingInvitationsReader,
    payoutRepository,
    connectTransferRepository,
    categoryRepo,
    venueRepo,
    watchlistRepo,
    artistWatchlistRepo,
    notificationReadRepo,
    notificationWriteRepo,
    paymentRepo,
    paymentRefundReconcileRepository,
    notificationPreferenceRepository,
    uiPreferenceRepository,
    emailObservabilityRepository,
    pushSubscriptionRepository,
    profileRepo,
    addressRepo,
    antiShillingGuard,
    notificationOutboxRepository,
    saleroomSessionLookup,
    amlScreeningRepository,
    amlHoldStore,
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    sourceOfFundsSettlementReader,
    lotLifecycleSnapshotRepository,
    lotLifecycleSnapshotReader,
    lotLifecycleTimelineReader,
    lotDocumentRepo,
    saleDocumentRepo,
    submissionDocumentRepo,
    uploadPersistenceRepository,
    telephoneBidBookingRepo,
    paddleRepo,
    saleroomCheckInRepo,
    saleExpectedGuestsReader,
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    onsiteEventClientReader,
    saleFollowRepo,
    artistProfileRepo,
    artistRegistryRepository,
    xeroConnRepo,
    paymentExtRepo,
    xeroWebhookEventRepository,
    displayPairingRepository,
    invitationRepository,
    entityInvitationRepository,
    saleModeLookup,
    lotMetrics,
    paymentMetrics,
    userMetrics,
    adminUserReader,
    adminUserKycReader,
    adminRoleManager,
    adminActivityReader,
    adminUserBidsReader,
    attentionFeedReader,
    saleroomDisplaySessionRepository,
    impersonationSessionRepository,
    impersonationDomainEventReader,
    saleBiddersReader,
    userSuspensionChecker,
    saleroomDisplaySnapshotReader,
    adminSaleOperationsSnapshotReader,
    adminLotBrowseReader,
    qrCodeAnalyticsReader,
    adminFinanceIssueSnapshotReader,
    adminOnboardingIssuesReader,
    adminReviewTaskReader,
    adminReviewTaskRepository,
    mediaAssetReader,
    qrCodeScanPersister,
    saleroomOnBlockReader,
    platformCatalogLegalEntityReader,
    paymentWebhookLookupReader,
    failedJobRepository,
    saleroomLiveSessionCounter,
    userEmailVerifiedPublisher,
    adminLegalEntityBrowseReader,
    adminManualReviewPaymentReader,
    adminManualReviewPaymentEnrichmentReader,
    adminDomainEventReader,
    adminDisputeCaseEnrichmentReader,
    legalEntityLifecycleAdminRepository,
    legalEntityMemberRepository,
    absenteeBidRepository,
    accountDeletionEligibilityReader,
    savedSearchRepository,
    emailSuppressionRepository,
    emailWebhookIngestRepository,
    uploadObjectReader,
    adminMarketingEventOutboxRepository,
    legalEntityDocumentAdminRepository,
    newsletterSignupRepository,
    webhookEventRepository,
  };
}
