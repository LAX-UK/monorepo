import type { Database } from "@auction/db";
import {
  DrizzleAbsenteeBidRepository,
  DrizzleAccountDeletionEligibilityReader,
  DrizzleAdminDisputeCaseEnrichmentReader,
  DrizzleAdminMarketingEventOutboxRepository,
  DrizzleAdminSaleOperationsSnapshotReader,
  DrizzleConnectTransferRepository,
  DrizzleEmailSuppressionRepository,
  DrizzleEmailWebhookIngestRepository,
  DrizzleImpersonationSessionRepository,
  DrizzleItemSubmissionRepository,
  DrizzleLegalEntityDocumentAdminRepository,
  DrizzleLegalEntityLifecycleAdminRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleLotLifecycleTimelineReader,
  DrizzleNewsletterSignupRepository,
  DrizzleOnsiteEventCheckInLogRepository,
  DrizzleOnsiteEventClientReader,
  DrizzlePaddleRepository,
  DrizzlePaymentRefundReconcileRepository,
  DrizzleQrCodeAnalyticsReader,
  DrizzleRepositoryFactory,
  DrizzleSaleRepository,
  DrizzleSaleroomDisplaySessionRepository,
  DrizzleSavedSearchRepository,
  DrizzleSourceOfFundsDocumentReviewRepository,
  DrizzleSourceOfFundsSettlementReader,
  DrizzleUploadObjectReader,
  DrizzleUploadPersistenceRepository,
  DrizzleUserEmailChangeRepository,
  DrizzleWebhookEventRepository,
  type IAbsenteeBidRepository,
  type IAccountDeletionEligibilityReader,
  type IAdminDisputeCaseEnrichmentReader,
  type IAdminMarketingEventOutboxRepository,
  type IAdminSaleOperationsSnapshotReader,
  type IConnectTransferRepository,
  type IEmailSuppressionRepository,
  type IEmailWebhookIngestRepository,
  type IImpersonationSessionRepository,
  type ILegalEntityDocumentAdminRepository,
  type ILegalEntityLifecycleAdminRepository,
  type ILotLifecycleSnapshotReader,
  type ILotLifecycleSnapshotRepository,
  type ILotLifecycleTimelineReader,
  type INewsletterSignupRepository,
  type IOnsiteEventCheckInLogRepository,
  type IOnsiteEventClientReader,
  type IPaddleRepository,
  type IPaymentRefundReconcileRepository,
  type IQrCodeAnalyticsReader,
  type ISaleroomDisplaySessionRepository,
  type ISavedSearchRepository,
  type ISourceOfFundsDocumentReviewRepository,
  type ISourceOfFundsSettlementReader,
  type IUploadObjectReader,
  type IUploadPersistenceRepository,
  type IUserEmailChangeRepository,
  type IWebhookEventRepository,
} from "@auction/persistence";
import { DrizzleAddressRepository } from "../repositories/drizzle-address.repository.js";
import { DrizzleAdminDomainEventReader } from "../repositories/drizzle-admin-domain-event.reader.js";
import { DrizzleAdminFinanceIssueSnapshotReader } from "../repositories/drizzle-admin-finance-issue-snapshot.reader.js";
import { DrizzleAdminLegalEntityBrowseReader } from "../repositories/drizzle-admin-legal-entity-browse.reader.js";
import { DrizzleAdminLotBrowseReader } from "../repositories/drizzle-admin-lot-browse.reader.js";
import { DrizzleAdminManualReviewPaymentEnrichmentReader } from "../repositories/drizzle-admin-manual-review-payment-enrichment.reader.js";
import { DrizzleAdminManualReviewPaymentReader } from "../repositories/drizzle-admin-manual-review-payment.reader.js";
import { DrizzleAdminOnboardingIssuesReader } from "../repositories/drizzle-admin-onboarding-issues.reader.js";
import { DrizzleAdminReviewTaskReader } from "../repositories/drizzle-admin-review-task.reader.js";
import { DrizzleAdminUserBidsReader } from "../repositories/drizzle-admin-user-bids.reader.js";
import { DrizzleAdminUserKycReader } from "../repositories/drizzle-admin-user-kyc.reader.js";
import {
  DrizzleAdminUserActivityReader,
  DrizzleAdminUserReader,
  DrizzleAdminUserRoleManager,
} from "../repositories/drizzle-admin-user.reader.js";
import {
  DrizzleAmlHoldStore,
  DrizzleAmlScreeningRepository,
} from "../repositories/drizzle-aml-screening.repository.js";
import { DrizzleAntiShillingRepository } from "../repositories/drizzle-anti-shilling.repository.js";
import { createDrizzleArtistProfileRepository } from "../repositories/drizzle-artist-profile.repository.js";
import { DrizzleArtistRegistryRepository } from "../repositories/drizzle-artist-registry.repository.js";
import { DrizzleArtistWatchlistRepository } from "../repositories/drizzle-artist-watchlist.repository.js";
import { DrizzleAttentionFeedReader } from "../repositories/drizzle-attention-feed.reader.js";
import { DrizzleCategoryRepository } from "../repositories/drizzle-category.repository.js";
import { DrizzleDisplayPairingRepository } from "../repositories/drizzle-display-pairing.repository.js";
import { DrizzleEmailObservabilityRepository } from "../repositories/drizzle-email-observability.repository.js";
import { DrizzleInvitationRepository } from "../repositories/drizzle-entity-invitation.repository.js";
import { DrizzleImpersonationDomainEventReader } from "../repositories/drizzle-impersonation-domain-event.reader.js";
import { DrizzleUserInvitationRepository } from "../repositories/drizzle-invitation.repository.js";
import { DrizzleKycRepository } from "../repositories/drizzle-kyc.repository.js";
import { DrizzleLegalEntityConnectRepository } from "../repositories/drizzle-legal-entity-connect.repository.js";
import { DrizzleLegalEntityMemberRepository } from "../repositories/drizzle-legal-entity-member.repository.js";
import { DrizzleLegalEntityNotificationRecipientRepository } from "../repositories/drizzle-legal-entity-notification-recipient.repository.js";
import { DrizzleLegalEntityOnboardingRepository } from "../repositories/drizzle-legal-entity-onboarding.repository.js";
import { createDrizzleLegalEntityRepository } from "../repositories/drizzle-legal-entity.repository.js";
import { DrizzleLotDocumentRepository } from "../repositories/drizzle-lot-document.repository.js";
import { DrizzleLotMetricsReader } from "../repositories/drizzle-lot-metrics.reader.js";
import { DrizzleNotificationOutboxRepository } from "../repositories/drizzle-notification-outbox.repository.js";
import { DrizzleNotificationPreferenceRepository } from "../repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "../repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "../repositories/drizzle-notification-write.repository.js";
import { DrizzleOnsiteEventRsvpRepository } from "../repositories/drizzle-onsite-event-rsvp.repository.js";
import { DrizzleOnsiteEventRepository } from "../repositories/drizzle-onsite-event.repository.js";
import { DrizzlePaymentExternalRefRepository } from "../repositories/drizzle-payment-external-ref.repository.js";
import { DrizzlePaymentMetricsReader } from "../repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRepository } from "../repositories/drizzle-payment.repository.js";
import { DrizzlePayoutRepository } from "../repositories/drizzle-payout.repository.js";
import { DrizzlePendingInvitationsReader } from "../repositories/drizzle-pending-invitations.reader.js";
import { DrizzleProfileRepository } from "../repositories/drizzle-profile.repository.js";
import { DrizzlePushSubscriptionRepository } from "../repositories/drizzle-push-subscription.repository.js";
import { DrizzleSaleBiddersReader } from "../repositories/drizzle-sale-bidders.reader.js";
import { DrizzleSaleDocumentRepository } from "../repositories/drizzle-sale-document.repository.js";
import { DrizzleSaleExpectedGuestsReader } from "../repositories/drizzle-sale-expected-guests.reader.js";
import { DrizzleSaleFollowRepository } from "../repositories/drizzle-sale-follow.repository.js";
import { DrizzleSaleModeLookup } from "../repositories/drizzle-sale-mode.lookup.js";
import { DrizzleSaleroomCheckInRepository } from "../repositories/drizzle-saleroom-check-in.repository.js";
import type { ISaleroomCheckInRepository } from "../repositories/drizzle-saleroom-check-in.repository.js";
import { DrizzleSaleroomDisplaySnapshotReader } from "../repositories/drizzle-saleroom-display-snapshot.reader.js";
import { DrizzleSaleroomSessionLookup } from "../repositories/drizzle-saleroom-session.lookup.js";
import { DrizzleSourceOfFundsDocumentRepository } from "../repositories/drizzle-source-of-funds-document.repository.js";
import type { ISourceOfFundsDocumentRepository } from "../repositories/drizzle-source-of-funds-document.repository.js";
import { DrizzleSourceOfFundsRepository } from "../repositories/drizzle-source-of-funds.repository.js";
import { DrizzleSubmissionDocumentRepository } from "../repositories/drizzle-submission-document.repository.js";
import { DrizzleTelephoneBidBookingRepository } from "../repositories/drizzle-telephone-bid-booking.repository.js";
import { DrizzleUiPreferenceRepository } from "../repositories/drizzle-ui-preference.repository.js";
import { DrizzleUserMetricsReader } from "../repositories/drizzle-user-metrics.reader.js";
import { DrizzleUserSuspensionChecker } from "../repositories/drizzle-user-suspension.checker.js";
import { DrizzleUserRepository } from "../repositories/drizzle-user.repository.js";
import { DrizzleVenueRepository } from "../repositories/drizzle-venue.repository.js";
import { DrizzleWatchlistRepository } from "../repositories/drizzle-watchlist.repository.js";
import { DrizzleXeroConnectionRepository } from "../repositories/drizzle-xero-connection.repository.js";
import { DrizzleXeroWebhookEventRepository } from "../repositories/drizzle-xero-webhook-event.repository.js";
import type { IAdminDomainEventReader } from "../repositories/interfaces/admin-domain-event.reader.js";
import type { IAdminFinanceIssueSnapshotReader } from "../repositories/interfaces/admin-finance-issue-snapshot.reader.js";
import type { IAdminLegalEntityBrowseReader } from "../repositories/interfaces/admin-legal-entity-browse.reader.js";
import type { IAdminLotBrowseReader } from "../repositories/interfaces/admin-lot-browse.reader.js";
import type { IAdminManualReviewPaymentEnrichmentReader } from "../repositories/interfaces/admin-manual-review-payment-enrichment.reader.js";
import type { IAdminManualReviewPaymentReader } from "../repositories/interfaces/admin-manual-review-payment.reader.js";
import type { IAdminOnboardingIssuesReader } from "../repositories/interfaces/admin-onboarding-issues.reader.js";
import type { IAdminReviewTaskReader } from "../repositories/interfaces/admin-review-task.reader.js";
import type { IArtistProfileAdminReader } from "../repositories/interfaces/artist-profile-admin.reader.js";
import type { IArtistProfileDirectoryReader } from "../repositories/interfaces/artist-profile-directory.reader.js";
import type { IArtistProfileCommandRepository } from "../repositories/interfaces/artist-profile.repository.js";
import type { IArtistRegistryRepository } from "../repositories/interfaces/artist-registry.repository.js";
import type { IImpersonationDomainEventReader } from "../repositories/interfaces/impersonation-domain-event.reader.js";
import type { IInvitationRepository } from "../repositories/interfaces/invitation.repository.js";
import type { ILegalEntityConnectReader } from "../repositories/interfaces/legal-entity-connect.reader.js";
import type { ILegalEntityConnectRepository } from "../repositories/interfaces/legal-entity-connect.repository.js";
import type { ILegalEntityMemberRepository } from "../repositories/interfaces/legal-entity-member.repository.js";
import type { ILegalEntityOnboardingRepository } from "../repositories/interfaces/legal-entity-onboarding.repository.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { ISaleExpectedGuestsReader } from "../repositories/interfaces/sale-expected-guests.reader.js";
import type { ISaleroomDisplaySnapshotReader } from "../repositories/interfaces/saleroom-display-snapshot.reader.js";
import type { ITelephoneBidBookingRepository } from "../repositories/interfaces/telephone-bid-booking.repository.js";
import type {
  IAmlHoldStore,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
} from "../services/aml/ports.js";
import type {
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserKycReader,
  IAdminUserReader,
  IAdminUserRoleManager,
} from "../services/interfaces/admin-user.js";
import type {
  ILotMetricsReader,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "../services/interfaces/analytics.js";
import type { IAntiShillingGuard } from "../services/interfaces/anti-shilling.js";
import type {
  IArtistDeleteGuards,
  IArtistDeleteRepository,
} from "../services/interfaces/artist-delete.js";
import type { IArtistWatchlistRepository } from "../services/interfaces/artist-watchlist.js";
import type { IAttentionFeedReader } from "../services/interfaces/attention-feed.js";
import type { ICategoryRepository } from "../services/interfaces/category.js";
import type { IDisplayPairingRepository } from "../services/interfaces/display-pairing-repository.js";
import type { IEmailObservabilityRepository } from "../services/interfaces/email-observability.js";
import type { IUserInvitationRepository } from "../services/interfaces/invitation.js";
import type { IKycRepository } from "../services/interfaces/kyc-repository.js";
import type { ILegalEntityNotificationRecipientReader } from "../services/interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";
import type { INotificationOutboxRepository } from "../services/interfaces/notification-outbox.js";
import type { INotificationPreferenceRepository } from "../services/interfaces/notification-preference.js";
import type { INotificationReadRepository } from "../services/interfaces/notification-read.js";
import type { INotificationWriteRepository } from "../services/interfaces/notification-write.js";
import type { IPaymentWriteRepository } from "../services/interfaces/payment-write.js";
import type { IPayoutRepository } from "../services/interfaces/payout-repository.js";
import type { IPendingInvitationsReader } from "../services/interfaces/pending-invitations-reader.js";
import type {
  IAddressRepository,
  IProfileReader,
  IProfileWriter,
} from "../services/interfaces/profile.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type { IItemSubmissionRepository } from "../services/interfaces/repositories.js";
import type {
  ILotDocumentRepository,
  ISaleDocumentRepository,
  ISaleRepository,
  ISubmissionDocumentRepository,
  IUserRepository,
} from "../services/interfaces/repositories.js";
import type { IRepositoryFactory } from "../services/interfaces/repository-factory.js";
import type { ISaleBiddersReader } from "../services/interfaces/sale-bidders.js";
import type { ISaleFollowRepository } from "../services/interfaces/sale-follow.js";
import type { ISaleModeLookup } from "../services/interfaces/sale-mode-lookup.js";
import type { ISaleroomSessionLookup } from "../services/interfaces/saleroom-session-lookup.js";
import type { IUiPreferenceRepository } from "../services/interfaces/ui-preference.js";
import type { IUserSuspensionChecker } from "../services/interfaces/user-suspension.js";
import type { IVenueRepository } from "../services/interfaces/venue.js";
import type { IWatchlistRepository } from "../services/interfaces/watchlist.js";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
} from "../services/interfaces/xero-repositories.js";
import type { IXeroWebhookEventRepository } from "../services/interfaces/xero-repositories.js";
import type { ISourceOfFundsRepository } from "../services/source-of-funds/source-of-funds.types.js";

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
  entityInvitationRepository: IInvitationRepository;
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
  const saleRepo = new DrizzleSaleRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const userEmailChangeRepository = new DrizzleUserEmailChangeRepository(db);
  const itemSubmissionRepository = new DrizzleItemSubmissionRepository(db);
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
