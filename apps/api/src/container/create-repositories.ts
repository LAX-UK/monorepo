import type { Database } from "@auction/db";
import { DrizzleAddressRepository } from "../repositories/drizzle-address.repository.js";
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
import { DrizzleArtistProfileRepository } from "../repositories/drizzle-artist-profile.repository.js";
import { DrizzleArtistWatchlistRepository } from "../repositories/drizzle-artist-watchlist.repository.js";
import { DrizzleCategoryRepository } from "../repositories/drizzle-category.repository.js";
import { DrizzleConveyorPipelineReader } from "../repositories/drizzle-conveyor-pipeline.reader.js";
import { DrizzleDisplayPairingRepository } from "../repositories/drizzle-display-pairing.repository.js";
import { DrizzleEmailObservabilityRepository } from "../repositories/drizzle-email-observability.repository.js";
import { DrizzleUserInvitationRepository } from "../repositories/drizzle-invitation.repository.js";
import { DrizzleItemSubmissionRepository } from "../repositories/drizzle-item-submission.repository.js";
import { DrizzleKycRepository } from "../repositories/drizzle-kyc.repository.js";
import { DrizzleLegalEntityNotificationRecipientRepository } from "../repositories/drizzle-legal-entity-notification-recipient.repository.js";
import { DrizzleLegalEntityRepository } from "../repositories/drizzle-legal-entity.repository.js";
import { DrizzleLotDocumentRepository } from "../repositories/drizzle-lot-document.repository.js";
import { DrizzleLotMetricsReader } from "../repositories/drizzle-lot-metrics.reader.js";
import { DrizzleNotificationOutboxRepository } from "../repositories/drizzle-notification-outbox.repository.js";
import { DrizzleNotificationPreferenceRepository } from "../repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "../repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "../repositories/drizzle-notification-write.repository.js";
import { DrizzleOnsiteEventCheckInLogRepository } from "../repositories/drizzle-onsite-event-check-in-log.repository.js";
import { DrizzleOnsiteEventClientReader } from "../repositories/drizzle-onsite-event-client.reader.js";
import { DrizzleOnsiteEventRsvpRepository } from "../repositories/drizzle-onsite-event-rsvp.repository.js";
import { DrizzleOnsiteEventRepository } from "../repositories/drizzle-onsite-event.repository.js";
import { DrizzlePaddleRepository } from "../repositories/drizzle-paddle.repository.js";
import { DrizzlePaymentExternalRefRepository } from "../repositories/drizzle-payment-external-ref.repository.js";
import { DrizzlePaymentMetricsReader } from "../repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRefundReconcileRepository } from "../repositories/drizzle-payment-refund-reconcile.repository.js";
import { DrizzlePaymentRepository } from "../repositories/drizzle-payment.repository.js";
import { DrizzlePayoutRepository } from "../repositories/drizzle-payout.repository.js";
import { DrizzlePendingInvitationsReader } from "../repositories/drizzle-pending-invitations.reader.js";
import { DrizzleProfileRepository } from "../repositories/drizzle-profile.repository.js";
import { DrizzlePushSubscriptionRepository } from "../repositories/drizzle-push-subscription.repository.js";
import { DrizzleRepositoryFactory } from "../repositories/drizzle-repository.factory.js";
import { DrizzleSaleBiddersReader } from "../repositories/drizzle-sale-bidders.reader.js";
import { DrizzleSaleDocumentRepository } from "../repositories/drizzle-sale-document.repository.js";
import { DrizzleSaleFollowRepository } from "../repositories/drizzle-sale-follow.repository.js";
import { DrizzleSaleModeLookup } from "../repositories/drizzle-sale-mode.lookup.js";
import { DrizzleSaleRepository } from "../repositories/drizzle-sale.repository.js";
import { DrizzleSaleroomCheckInRepository } from "../repositories/drizzle-saleroom-check-in.repository.js";
import { DrizzleSaleroomSessionLookup } from "../repositories/drizzle-saleroom-session.lookup.js";
import { DrizzleSourceOfFundsDocumentReviewRepository } from "../repositories/drizzle-source-of-funds-document-review.repository.js";
import { DrizzleSourceOfFundsDocumentRepository } from "../repositories/drizzle-source-of-funds-document.repository.js";
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
import { DrizzleAttentionFeedReader } from "../services/attention-feed.service.js";
import type { IAntiShillingGuard } from "../services/interfaces/anti-shilling.js";
import type { IEmailObservabilityRepository } from "../services/interfaces/email-observability.js";
import type { IKycRepository } from "../services/interfaces/kyc-repository.js";
import type { ILegalEntityNotificationRecipientReader } from "../services/interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";
import type { INotificationPreferenceRepository } from "../services/interfaces/notification-preference.js";
import type { IPayoutRepository } from "../services/interfaces/payout-repository.js";
import type { IPendingInvitationsReader } from "../services/interfaces/pending-invitations-reader.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type { IItemSubmissionRepository } from "../services/interfaces/repositories.js";
import type { IRepositoryFactory } from "../services/interfaces/repository-factory.js";
import type { IUiPreferenceRepository } from "../services/interfaces/ui-preference.js";
import type { IXeroWebhookEventRepository } from "../services/interfaces/xero-repositories.js";

/** Drizzle repositories and readers constructed from a single `Database` connection. */
export type ContainerRepositories = {
  repoFactory: IRepositoryFactory;
  lotRepo: ReturnType<IRepositoryFactory["forConnection"]>["lot"];
  saleRepo: DrizzleSaleRepository;
  userRepo: DrizzleUserRepository;
  itemSubmissionRepository: IItemSubmissionRepository;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  kycRepository: IKycRepository;
  pendingInvitationsReader: IPendingInvitationsReader;
  payoutRepository: IPayoutRepository;
  categoryRepo: DrizzleCategoryRepository;
  venueRepo: DrizzleVenueRepository;
  watchlistRepo: DrizzleWatchlistRepository;
  artistWatchlistRepo: DrizzleArtistWatchlistRepository;
  notificationReadRepo: DrizzleNotificationReadRepository;
  notificationWriteRepo: DrizzleNotificationWriteRepository;
  paymentRepo: DrizzlePaymentRepository;
  paymentRefundReconcileRepository: DrizzlePaymentRefundReconcileRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceRepository: IUiPreferenceRepository;
  emailObservabilityRepository: IEmailObservabilityRepository;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  profileRepo: DrizzleProfileRepository;
  addressRepo: DrizzleAddressRepository;
  antiShillingGuard: IAntiShillingGuard;
  notificationOutboxRepository: DrizzleNotificationOutboxRepository;
  saleroomSessionLookup: DrizzleSaleroomSessionLookup;
  amlScreeningRepository: DrizzleAmlScreeningRepository;
  amlHoldStore: DrizzleAmlHoldStore;
  sourceOfFundsRepository: DrizzleSourceOfFundsRepository;
  sourceOfFundsDocumentRepository: DrizzleSourceOfFundsDocumentRepository;
  sourceOfFundsDocumentReviewRepository: DrizzleSourceOfFundsDocumentReviewRepository;
  lotDocumentRepo: DrizzleLotDocumentRepository;
  saleDocumentRepo: DrizzleSaleDocumentRepository;
  submissionDocumentRepo: DrizzleSubmissionDocumentRepository;
  telephoneBidBookingRepo: DrizzleTelephoneBidBookingRepository;
  paddleRepo: DrizzlePaddleRepository;
  saleroomCheckInRepo: DrizzleSaleroomCheckInRepository;
  onsiteEventRepo: DrizzleOnsiteEventRepository;
  onsiteEventRsvpRepo: DrizzleOnsiteEventRsvpRepository;
  onsiteEventCheckInLogRepo: DrizzleOnsiteEventCheckInLogRepository;
  onsiteEventClientReader: DrizzleOnsiteEventClientReader;
  saleFollowRepo: DrizzleSaleFollowRepository;
  artistProfileRepo: DrizzleArtistProfileRepository;
  xeroConnRepo: DrizzleXeroConnectionRepository;
  paymentExtRepo: DrizzlePaymentExternalRefRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  displayPairingRepository: DrizzleDisplayPairingRepository;
  invitationRepository: DrizzleUserInvitationRepository;
  saleModeLookup: DrizzleSaleModeLookup;
  lotMetrics: DrizzleLotMetricsReader;
  paymentMetrics: DrizzlePaymentMetricsReader;
  userMetrics: DrizzleUserMetricsReader;
  adminUserReader: DrizzleAdminUserReader;
  adminUserKycReader: DrizzleAdminUserKycReader;
  adminRoleManager: DrizzleAdminUserRoleManager;
  adminActivityReader: DrizzleAdminUserActivityReader;
  adminUserBidsReader: DrizzleAdminUserBidsReader;
  attentionFeedReader: DrizzleAttentionFeedReader;
  conveyorPipelineReader: DrizzleConveyorPipelineReader;
  saleBiddersReader: DrizzleSaleBiddersReader;
  userSuspensionChecker: DrizzleUserSuspensionChecker;
};

export function createRepositories(db: Database): ContainerRepositories {
  const repoFactory: IRepositoryFactory = new DrizzleRepositoryFactory(db);
  const lotRepo = repoFactory.root.lot;
  const saleRepo = new DrizzleSaleRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const itemSubmissionRepository = new DrizzleItemSubmissionRepository(db);
  const legalEntityRepository = new DrizzleLegalEntityRepository(db);
  const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader =
    new DrizzleLegalEntityNotificationRecipientRepository(db);
  const kycRepository = new DrizzleKycRepository(db);
  const pendingInvitationsReader: IPendingInvitationsReader = new DrizzlePendingInvitationsReader(
    db,
  );
  const payoutRepository: IPayoutRepository = new DrizzlePayoutRepository(db);
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
  const lotDocumentRepo = new DrizzleLotDocumentRepository(db);
  const saleDocumentRepo = new DrizzleSaleDocumentRepository(db);
  const submissionDocumentRepo = new DrizzleSubmissionDocumentRepository(db);
  const telephoneBidBookingRepo = new DrizzleTelephoneBidBookingRepository(db);
  const paddleRepo = new DrizzlePaddleRepository(db);
  const saleroomCheckInRepo = new DrizzleSaleroomCheckInRepository(db);
  const onsiteEventRepo = new DrizzleOnsiteEventRepository(db);
  const onsiteEventRsvpRepo = new DrizzleOnsiteEventRsvpRepository(db);
  const onsiteEventCheckInLogRepo = new DrizzleOnsiteEventCheckInLogRepository(db);
  const onsiteEventClientReader = new DrizzleOnsiteEventClientReader(db);
  const saleFollowRepo = new DrizzleSaleFollowRepository(db);
  const artistProfileRepo = new DrizzleArtistProfileRepository(db);
  const xeroConnRepo = new DrizzleXeroConnectionRepository(db);
  const paymentExtRepo = new DrizzlePaymentExternalRefRepository(db);
  const xeroWebhookEventRepository = new DrizzleXeroWebhookEventRepository(db);
  const displayPairingRepository = new DrizzleDisplayPairingRepository(db);
  const invitationRepository = new DrizzleUserInvitationRepository(db);
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
  const conveyorPipelineReader = new DrizzleConveyorPipelineReader(db);
  const saleBiddersReader = new DrizzleSaleBiddersReader(db);
  const userSuspensionChecker = new DrizzleUserSuspensionChecker(db);

  return {
    repoFactory,
    lotRepo,
    saleRepo,
    userRepo,
    itemSubmissionRepository,
    legalEntityRepository,
    legalEntityNotificationRecipients,
    kycRepository,
    pendingInvitationsReader,
    payoutRepository,
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
    lotDocumentRepo,
    saleDocumentRepo,
    submissionDocumentRepo,
    telephoneBidBookingRepo,
    paddleRepo,
    saleroomCheckInRepo,
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    onsiteEventClientReader,
    saleFollowRepo,
    artistProfileRepo,
    xeroConnRepo,
    paymentExtRepo,
    xeroWebhookEventRepository,
    displayPairingRepository,
    invitationRepository,
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
    conveyorPipelineReader,
    saleBiddersReader,
    userSuspensionChecker,
  };
}
