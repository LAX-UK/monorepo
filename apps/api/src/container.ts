import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { IClickIdStore, IMarketingEventPublisher } from "@auction/marketing-events";
import type { LegalEntityArchiveQueueProducer } from "@auction/queues";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { createAdminServices } from "./container/create-admin-services.js";
import { createContainerAuth } from "./container/create-auth.js";
import { createBiddingRouteServices } from "./container/create-bidding-route-services.js";
import { createBiddingSaleroom } from "./container/create-bidding-saleroom.js";
import { createCatalogServices } from "./container/create-catalog-services.js";
import { createComplianceMedia } from "./container/create-compliance-media.js";
import { createInfra } from "./container/create-infra.js";
import { createLotLifecycle } from "./container/create-lot-lifecycle.js";
import { createPaymentsServices } from "./container/create-payments-services.js";
import { createPlatformServices } from "./container/create-platform-services.js";
import { createRepositories } from "./container/create-repositories.js";
import { createUserMiscServices } from "./container/create-user-misc-services.js";
import type { Env } from "./env.js";
import type { OrgModuleGate } from "./lib/org-module-gate.js";
import type { PlatformCatalogLegalEntityIdProvider } from "./lib/platform-catalog-legal-entity.js";
import type { IStripeClientFactory } from "./lib/stripe-client.js";
import type { StripeWebhookVerifier } from "./lib/stripe-webhook-verifier.js";
import type {
  createRequireLegalEntityContext,
  createSubmissionsLegalEntityContext,
} from "./middleware/require-legal-entity-context.js";
import type { IXeroPaymentRecorder } from "./services/accounting/xero-payment-recorder.js";
import type { XeroPayoutBillWriter } from "./services/accounting/xero-payout-bill.writer.js";
import type { AddressService } from "./services/address.service.js";
import type { AdminMetricsService } from "./services/admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "./services/admin-sale-operations-snapshot.service.js";
import type { AdminUserService } from "./services/admin-user.service.js";
import type { AdminLotBrowseService } from "./services/admin/admin-lot-browse.service.js";
import type { AdminMarketingEventsService } from "./services/admin/admin-marketing-events.service.js";
import type { AdminNavCountsService } from "./services/admin/admin-nav-counts.service.js";
import type { AdminPaymentListQueryService } from "./services/admin/admin-payment-list-query.service.js";
import type { IAdminSourceOfFundsQueryService } from "./services/admin/admin-source-of-funds-query.service.js";
import type { LegalEntityDocumentAdminService } from "./services/admin/legal-entity-document-admin.service.js";
import type { BullMQQueueInspector } from "./services/admin/queue-inspector.service.js";
import type { BullMQQueueMutator } from "./services/admin/queue-mutator.service.js";
import type { AmlService } from "./services/aml/aml.service.js";
import type { ArtistDeleteService } from "./services/artist-delete.service.js";
import type { ArtistProfileService } from "./services/artist-profile.service.js";
import type { ArtistWatchlistService } from "./services/artist-watchlist.service.js";
import type { AuthAuditPublisher } from "./services/auth-audit.publisher.js";
import type { AutoBidService } from "./services/auto-bid.service.js";
import type { BidService } from "./services/bid.service.js";
import type { SaleroomOnBlockPolicy } from "./services/bid/saleroom-on-block.policy.js";
import type { CachedCatalogueListService } from "./services/cached-catalogue-list.service.js";
import type { CategoryService } from "./services/category.service.js";
import type { DashboardQueryService } from "./services/dashboard-query.service.js";
import type { DomainEventPublisher } from "./services/domain-event.publisher.js";
import type { EmailUnsubscribeService } from "./services/email-unsubscribe.service.js";
import type { EntityDocumentService } from "./services/entity-document.service.js";
import type { ExportService } from "./services/export/export.service.js";
import type { ImpersonationAuditService } from "./services/impersonation-audit.service.js";
import type { ImpersonationSessionService } from "./services/impersonation-session.service.js";
import type { IAbsenteeBidService } from "./services/interfaces/absentee-bid-service.js";
import type { IAdminKpiTrendService } from "./services/interfaces/admin-kpi-trend.js";
import type { AdminRouteServices } from "./services/interfaces/admin-routes.js";
import type { IAnalyticsService } from "./services/interfaces/analytics.js";
import type { IArtistRegistryService } from "./services/interfaces/artist-registry.js";
import type { IAttentionFeedReader } from "./services/interfaces/attention-feed.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { BiddingRouteServices } from "./services/interfaces/bidding-routes.js";
import type { IConditionReportService } from "./services/interfaces/condition-report.js";
import type { IDisplayOverlayService } from "./services/interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "./services/interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "./services/interfaces/display-snapshot-reader.js";
import type { IEmailObservabilityRepository } from "./services/interfaces/email-observability.js";
import type { IHttpErrorHandler } from "./services/interfaces/error-handling.js";
import type { IInvitationLifecycleService } from "./services/interfaces/invitation-lifecycle.js";
import type { IInvoiceAccountingProvider } from "./services/interfaces/invoice-accounting.js";
import type { IItemSubmissionService } from "./services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "./services/interfaces/job-scheduler.js";
import type { IKycRepository } from "./services/interfaces/kyc-repository.js";
import type { IKycService } from "./services/interfaces/kyc-service.js";
import type { ILegalEntityNotificationRecipientReader } from "./services/interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./services/interfaces/legal-entity-repository.js";
import type { IMarketingEventService } from "./services/interfaces/marketing-event-service.js";
import type { IMemberManagementService } from "./services/interfaces/member-management.js";
import type { INotificationOutboxProcessor } from "./services/interfaces/notification-outbox.js";
import type { INotificationPreferenceRepository } from "./services/interfaces/notification-preference.js";
import type { IObjectStorage } from "./services/interfaces/object-storage.js";
import type { IOnsiteEventCheckInService } from "./services/interfaces/onsite-event-check-in-service.js";
import type { IOnsiteEventRsvpService } from "./services/interfaces/onsite-event-rsvp-service.js";
import type { IOrganizationOnboardingService } from "./services/interfaces/organization-onboarding.js";
import type { IPayoutRepository } from "./services/interfaces/payout-repository.js";
import type { IPayoutService } from "./services/interfaces/payout.js";
import type { IPendingInvitationsReader } from "./services/interfaces/pending-invitations-reader.js";
import type { IPressArchiveReadService } from "./services/interfaces/press-archive-read.service.js";
import type { IPushSubscriptionRepository } from "./services/interfaces/push.js";
import type { IRateLimitStore } from "./services/interfaces/rate-limit-store.js";
import type { IRegistrationService } from "./services/interfaces/registration.js";
import type { IItemSubmissionRepository } from "./services/interfaces/repositories.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import type { ISaleRegistrationService } from "./services/interfaces/sale-registration-service.js";
import type { ISaleStatusTransitionService } from "./services/interfaces/sale-status-transition.js";
import type { ISaleroomCheckInService } from "./services/interfaces/saleroom-check-in-service.js";
import type { ISaleroomService } from "./services/interfaces/saleroom-service.js";
import type { IStripeConnectService } from "./services/interfaces/stripe-connect.js";
import type { ITelephoneBidBookingService } from "./services/interfaces/telephone-bid-booking-service.js";
import type { ITransactionalMailer } from "./services/interfaces/transactional-mail.js";
import type { IUiPreferenceRepository } from "./services/interfaces/ui-preference.js";
import type {
  IUserSuspensionCacheInvalidator,
  IUserSuspensionChecker,
} from "./services/interfaces/user-suspension.js";
import type { IXeroWebhookEventRepository } from "./services/interfaces/xero-repositories.js";
import type { InvitationService } from "./services/invitation.service.js";
import type { InvoiceAddressingService } from "./services/invoice-addressing.js";
import type { KycResubmissionNotifier } from "./services/kyc/kyc-resubmission-notifier.js";
import type { LegalEntityAccessService } from "./services/legal-entity-access.service.js";
import type { LegalEntityLifecycleAdminService } from "./services/legal-entity-lifecycle-admin.service.js";
import { EnsurePersonalLegalEntityService } from "./services/legal-entity/ensure-personal-legal-entity.service.js";
import type { IPersonalLegalEntityResolver } from "./services/legal-entity/personal-legal-entity-resolver.service.js";
import type { LotFulfilmentService } from "./services/lot-fulfilment.service.js";
import type { LotInvoiceInitiationService } from "./services/lot-invoice-initiation.service.js";
import type { LotLifecycleQueryService } from "./services/lot-lifecycle-query.service.js";
import type { LotLifecycleService } from "./services/lot-lifecycle.service.js";
import type { LotSoftDeleteService } from "./services/lot-soft-delete.service.js";
import type { LotTransitionOrchestrator } from "./services/lot-transition-orchestrator.js";
import type { LotService } from "./services/lot.service.js";
import type { MediaAssetEnricher } from "./services/media-asset-enricher.js";
import type { MediaUrlResolver } from "./services/media-url-resolver.js";
import type { NotificationQueryService } from "./services/notification-query.service.js";
import type { NotificationDispatcher } from "./services/notification.dispatcher.js";
import type { NotificationFactory } from "./services/notification.factory.js";
import type { NotificationService } from "./services/notification.service.js";
import type { OrganizationOnboardingFlowService } from "./services/organization-onboarding/organization-onboarding-flow.service.js";
import type { PaddleService } from "./services/paddle.service.js";
import type { PaymentService } from "./services/payment.service.js";
import type { PaymentRefundReconcileService } from "./services/payment/payment-refund-reconcile.service.js";
import type { PostmarkWebhookService } from "./services/postmark-webhook.service.js";
import type { ProfileService } from "./services/profile.service.js";
import type { QrCodeAnalyticsService } from "./services/qr-code-analytics.service.js";
import type { QrCodeService } from "./services/qr-code.service.js";
import type { SaleBiddersService } from "./services/sale-bidders.service.js";
import type { SaleFollowService } from "./services/sale-follow.service.js";
import type { SaleLifecycleService } from "./services/sale-lifecycle.service.js";
import type { ISaleListReadService } from "./services/sale-list-read.service.js";
import type { SaleSoftDeleteService } from "./services/sale-soft-delete.service.js";
import type { SaleService } from "./services/sale.service.js";
import type { SavedSearchService } from "./services/saved-search.service.js";
import { SessionRevocationService } from "./services/session-revocation.service.js";
import type { SourceOfFundsDocumentCollectionService } from "./services/source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "./services/source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "./services/source-of-funds/source-of-funds.service.js";
import type { StripePaymentWebhookService } from "./services/stripe-payment-webhook.service.js";
import type { UiPreferenceService } from "./services/ui-preference.service.js";
import type { UploadService } from "./services/upload.service.js";
import type { UserDashboardReadService } from "./services/user-dashboard-read.service.js";
import type { UserService } from "./services/user.service.js";
import type { VenueService } from "./services/venue.service.js";
import type { WatchlistService } from "./services/watchlist.service.js";
import type { XeroOAuthService } from "./services/xero-oauth.service.js";

export type Container = {
  env: Env;
  db: ReturnType<typeof createDb>;
  /** Drizzle client bound to the `auth_app` Postgres role.
   *
   * Use ONLY for writes that must touch Better Auth identity columns the
   * `api_app` role is intentionally denied (currently `user.email` and
   * `user.email_verified`). All routine reads + writes continue through `db`.
   * Keeping this separate enforces the per-role least-privilege boundary set up
   * in `packages/db/src/migrate-roles.ts`.
   */
  authDb: ReturnType<typeof createDb>;
  /** Revokes Better Auth sessions in `authDb` (password reset, email change, etc.). */
  sessionRevocation: SessionRevocationService;
  redis: Redis;
  rateLimitStore: IRateLimitStore;
  /** Exposed for web push subscription (public key only). */
  vapidPublicKey: string | null;
  auth: Auth;
  getPublicJwks: () => Promise<{ keys: unknown[] }>;
  authenticator: IAuthenticator;
  repoFactory: IRepositoryFactory;
  lotService: LotService;
  conditionReportService: IConditionReportService;
  saleService: SaleService;
  saleListReadService: ISaleListReadService;
  pressArchiveReadService: IPressArchiveReadService;
  venueService: VenueService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  saleSoftDeleteService: SaleSoftDeleteService;
  lotSoftDeleteService: LotSoftDeleteService;
  saleFollowService: SaleFollowService;
  saleBiddersService: SaleBiddersService;
  saleRegistrationService: ISaleRegistrationService;
  lotLifecycleService: LotLifecycleService;
  lotLifecycleQueryService: LotLifecycleQueryService;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  adminLotBrowseService: AdminLotBrowseService;
  absenteeBidService: IAbsenteeBidService;
  telephoneBidBookingService: ITelephoneBidBookingService;
  paddleService: PaddleService;
  saleroomCheckInService: ISaleroomCheckInService;
  onsiteEventRsvpService: IOnsiteEventRsvpService;
  onsiteEventCheckInService: IOnsiteEventCheckInService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomService: ISaleroomService;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  displaySnapshotReader: IDisplaySnapshotReader;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  lotFulfilmentService: LotFulfilmentService;
  saleLifecycleService: SaleLifecycleService;
  lotJobScheduler: ILotJobScheduler;
  saleStatusTransitionService: ISaleStatusTransitionService;
  bidService: BidService;
  autoBidService: AutoBidService;
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  artistDeleteService: ArtistDeleteService;
  dashboardQueryService: DashboardQueryService;
  userDashboardReadService: UserDashboardReadService;
  cachedCatalogueListService: CachedCatalogueListService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
  lotInvoiceInitiationService: LotInvoiceInitiationService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  paymentRefundReconcileService: PaymentRefundReconcileService;
  accountingProvider: IInvoiceAccountingProvider;
  /** bill-to resolver for Xero + payment-invoice email. */
  invoiceAddressingService: InvoiceAddressingService;
  /** Xero ACCPAY bill creation for paid payouts (null when Xero OAuth env not set). */
  xeroPayoutBillWriter: XeroPayoutBillWriter | null;
  /** Records Stripe capture against Xero ACCREC invoices (null when Xero env not set). */
  xeroPaymentRecorder: IXeroPaymentRecorder | null;
  xeroOAuthService: XeroOAuthService | null;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  userService: UserService;
  watchlistService: WatchlistService;
  savedSearchService: SavedSearchService;
  artistWatchlistService: ArtistWatchlistService;
  notificationService: NotificationService;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceRepository: IUiPreferenceRepository;
  uiPreferenceService: UiPreferenceService;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  notificationDispatcher: NotificationDispatcher;
  notificationOutboxProcessor: INotificationOutboxProcessor;
  notificationFactory: NotificationFactory;
  emailService: IEmailService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  userSuspensionChecker: IUserSuspensionChecker;
  userSuspensionCacheInvalidator: IUserSuspensionCacheInvalidator;
  registrationService: IRegistrationService;
  invitationService: InvitationService;
  profileService: ProfileService;
  addressService: AddressService;
  analyticsService: IAnalyticsService;
  domainEventPublisher: DomainEventPublisher;
  /** `auth.*` rows in `domain_events` (password setup, email change, suspension, etc.). */
  authAuditPublisher: AuthAuditPublisher;
  /** admin KYB status transitions + domain events. */
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  /** admin KYB document list/review. */
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  /** timeout audit + shared legal-entity middleware (impersonation cookie). */
  impersonationAuditService: ImpersonationAuditService;
  impersonationSessionService: ImpersonationSessionService;
  legalEntityAccessService: LegalEntityAccessService;
  requireLegalEntityContext: ReturnType<typeof createRequireLegalEntityContext>;
  requireSubmissionsLegalEntityContext: ReturnType<typeof createSubmissionsLegalEntityContext>;
  adminUserService: AdminUserService;
  adminNavCountsService: AdminNavCountsService;
  adminLotsKpiTrendService: IAdminKpiTrendService;
  adminPaymentsKpiTrendService: IAdminKpiTrendService;
  adminSalesKpiTrendService: IAdminKpiTrendService;
  adminPayoutsKpiTrendService: IAdminKpiTrendService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  httpErrorHandler: IHttpErrorHandler;
  itemSubmissionRepository: IItemSubmissionRepository;
  itemSubmissionService: IItemSubmissionService;
  /** legal entity repository (membership + acting context). */
  legalEntityRepository: ILegalEntityRepository;
  /** Lazily provisions personal legal entities for client flows. */
  personalLegalEntityResolver: IPersonalLegalEntityResolver;
  /** role-aware notification recipient lookup for legal entities. */
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  /** KYC (Veriff identity verification). */
  kycRepository: IKycRepository;
  kycService: IKycService;
  kycResubmissionNotifier: KycResubmissionNotifier;
  /** AML / sanctions / PEP watchlist screening + ongoing monitoring. */
  amlService: AmlService;
  /** Source-of-Funds (CDD Section 6) collection + MLRO/finance review gate. */
  sourceOfFundsService: SourceOfFundsService;
  /** Admin read models for SoF compliance queues (list enrichment + detail). */
  adminSourceOfFundsQueryService: IAdminSourceOfFundsQueryService;
  /** In-platform SoF document request / upload / submit flow. */
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  /** Staff per-document verification checklist (event-sourced). */
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  /** organisation onboarding. */
  organizationOnboardingService: IOrganizationOnboardingService;
  /** Production-domain gate for org module mutations. */
  orgModuleGate: OrgModuleGate;
  /** organisation multi-step onboarding (Phase D). */
  organizationOnboardingFlowService: OrganizationOnboardingFlowService;
  /** artist registry (search, merge, review). */
  artistRegistryService: IArtistRegistryService;
  /** Stripe Connect Express. */
  stripeConnectService: IStripeConnectService;
  /** legal entity member management (role changes, transfers, removes). */
  memberManagementService: IMemberManagementService;
  /** Pending entity-scoped invitations for the current user's email (inbox). */
  pendingInvitationsReader: IPendingInvitationsReader;
  /** Entity invite create / accept / decline. */
  invitationLifecycleService: IInvitationLifecycleService;
  /** Outbound transactional mail (invite emails, etc.). */
  transactionalMailer: ITransactionalMailer;
  /** payout aggregation + admin settlement controls. */
  payoutRepository: IPayoutRepository;
  payoutService: IPayoutService;
  objectStorage: IObjectStorage;
  mediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
  uploadService: UploadService;
  lotDocumentService: EntityDocumentService<string>;
  saleDocumentService: EntityDocumentService<string>;
  submissionDocumentService: EntityDocumentService<string>;
  uploadValidationQueue: Queue;
  imageCleanupQueue: Queue;
  marketingSyncQueue: Queue;
  /** BullMQ queue consumed by worker to render payout PDFs to Spaces. */
  /** Async CSV export jobs (worker-generated files in object storage). */
  dataExportQueue: Queue;
  exportService: ExportService;
  payoutStatementQueue: Queue;
  /** cascade work when a legal entity is archived (proxies, lots flag, member email). */
  legalEntityArchiveQueue: LegalEntityArchiveQueueProducer;
  /** Service for handling Stripe payment webhooks (disputes, refunds). */
  stripePaymentWebhookService: StripePaymentWebhookService | null;
  /** Shared Stripe SDK client (pinned API version). */
  stripeClientFactory: IStripeClientFactory;
  /** Webhook signature verification for all Stripe surfaces. */
  stripeWebhookVerifier: StripeWebhookVerifier;
  marketingEventService: IMarketingEventService;
  marketingEventPublisher: IMarketingEventPublisher;
  clickIdStore: IClickIdStore;
  postmarkWebhookService: PostmarkWebhookService;
  adminMarketingEventsService: AdminMarketingEventsService;
  emailUnsubscribeService: EmailUnsubscribeService;
  /** Lot bidding HTTP orchestration (auto-bid, absentee, condition-report requests). Route files under `routes/lots/bidding*` should use this facade only; run `pnpm --filter @auction/api check:bidding-dip`. */
  bidding: BiddingRouteServices;
  /** Platform-admin HTTP orchestration (SOLID application layer for `routes/admin*`). Keep route files on `container.admin` only; run `pnpm --filter @auction/api check:admin-dip` in CI. */
  admin: AdminRouteServices;
  /** Engineering-only BullMQ inspection and mutations (super_admin). */
  queueAdmin: {
    inspector: BullMQQueueInspector;
    mutator: BullMQQueueMutator;
    close: () => Promise<void>;
  };
  closeBullQueues: () => Promise<void>;
};

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL_API ?? env.DATABASE_URL);
  const authDb = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const infra = createInfra(env, db, authDb);

  const sessionRevocation = new SessionRevocationService(authDb);
  const ensurePersonalLegalEntityService = new EnsurePersonalLegalEntityService(db);
  const { auth, authenticator } = createContainerAuth({
    env,
    db,
    authDb,
    emailService: infra.emailService,
    sessionRevocation,
    ensurePersonalLegalEntityService,
  });

  const repos = createRepositories(db);

  const platform = createPlatformServices({ env, db, infra, repos });
  const lotLifecycle = createLotLifecycle({ infra, repos, platform });
  const complianceMedia = createComplianceMedia({ env, db, infra, repos, platform });
  const catalog = createCatalogServices({
    env,
    db,
    infra,
    repos,
    platform,
    lotLifecycle,
    complianceMedia,
  });
  const payments = createPaymentsServices({
    env,
    db,
    infra,
    repos,
    platform,
    complianceMedia,
    catalog,
  });
  const biddingSaleroom = createBiddingSaleroom({
    env,
    db,
    infra,
    repos,
    platform,
    lotLifecycle,
    complianceMedia,
    catalog,
    payments,
  });
  const userMisc = createUserMiscServices({
    env,
    db,
    authDb,
    auth,
    sessionRevocation,
    ensurePersonalLegalEntityService,
    infra,
    repos,
    platform,
    complianceMedia,
    catalog,
    payments,
  });
  const admin = createAdminServices({
    env,
    db,
    infra,
    repos,
    platform,
    complianceMedia,
    catalog,
    payments,
    bidding: biddingSaleroom,
    userMisc,
  });

  return {
    env,
    db,
    authDb,
    sessionRevocation,
    redis: infra.redis,
    rateLimitStore: infra.rateLimitStore,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    auth,
    getPublicJwks: infra.getPublicJwks,
    authenticator,
    repoFactory: repos.repoFactory,
    lotService: catalog.lotService,
    conditionReportService: catalog.conditionReportService,
    saleService: catalog.saleService,
    saleListReadService: catalog.saleListReadService,
    pressArchiveReadService: catalog.pressArchiveReadService,
    saleSoftDeleteService: catalog.saleSoftDeleteService,
    lotSoftDeleteService: catalog.lotSoftDeleteService,
    saleFollowService: catalog.saleFollowService,
    saleBiddersService: catalog.saleBiddersService,
    saleRegistrationService: biddingSaleroom.saleRegistrationService,
    lotLifecycleService: lotLifecycle.lotLifecycleService,
    lotLifecycleQueryService: catalog.lotLifecycleQueryService,
    lotTransitionOrchestrator: catalog.lotTransitionOrchestrator,
    adminLotBrowseService: catalog.adminLotBrowseService,
    absenteeBidService: biddingSaleroom.absenteeBidService,
    telephoneBidBookingService: catalog.telephoneBidBookingService,
    paddleService: catalog.paddleService,
    saleroomCheckInService: catalog.saleroomCheckInService,
    onsiteEventRsvpService: catalog.onsiteEventRsvpService,
    onsiteEventCheckInService: catalog.onsiteEventCheckInService,
    adminSaleOperationsSnapshotService: biddingSaleroom.adminSaleOperationsSnapshotService,
    saleroomService: biddingSaleroom.saleroomService,
    displayPairingService: biddingSaleroom.displayPairingService,
    displayOverlayService: biddingSaleroom.displayOverlayService,
    displaySnapshotReader: biddingSaleroom.displaySnapshotReader,
    saleroomOnBlockPolicy: biddingSaleroom.saleroomOnBlockPolicy,
    lotFulfilmentService: payments.lotFulfilmentService,
    saleLifecycleService: lotLifecycle.saleLifecycleService,
    lotJobScheduler: catalog.lotJobScheduler,
    saleStatusTransitionService: catalog.saleStatusTransitionService,
    bidService: biddingSaleroom.bidService,
    autoBidService: biddingSaleroom.autoBidService,
    categoryService: catalog.categoryService,
    venueService: catalog.venueService,
    resolvePlatformCatalogLegalEntityId: catalog.resolvePlatformCatalogLegalEntityId,
    artistProfileService: catalog.artistProfileService,
    artistDeleteService: catalog.artistDeleteService,
    dashboardQueryService: catalog.dashboardQueryService,
    userDashboardReadService: userMisc.userDashboardReadService,
    cachedCatalogueListService: platform.cachedCatalogueListService,
    notificationQueryService: catalog.notificationQueryService,
    paymentService: payments.paymentService,
    lotInvoiceInitiationService: payments.lotInvoiceInitiationService,
    qrCodeService: catalog.qrCodeService,
    qrCodeAnalytics: catalog.qrCodeAnalytics,
    paymentRefundReconcileService: platform.paymentRefundReconcileService,
    accountingProvider: payments.accountingProvider,
    invoiceAddressingService: platform.invoiceAddressingService,
    xeroPayoutBillWriter: payments.xeroPayoutBillWriter,
    xeroPaymentRecorder: payments.xeroPaymentRecorder,
    xeroOAuthService: payments.xeroOAuthService,
    xeroWebhookEventRepository: repos.xeroWebhookEventRepository,
    userService: userMisc.userService,
    watchlistService: userMisc.watchlistService,
    savedSearchService: userMisc.savedSearchService,
    artistWatchlistService: userMisc.artistWatchlistService,
    notificationService: platform.notificationService,
    notificationPreferenceRepository: repos.notificationPreferenceRepository,
    uiPreferenceRepository: repos.uiPreferenceRepository,
    uiPreferenceService: platform.uiPreferenceService,
    pushSubscriptionRepository: repos.pushSubscriptionRepository,
    notificationDispatcher: platform.notificationDispatcher,
    notificationOutboxProcessor: platform.notificationOutboxProcessor,
    notificationFactory: platform.notificationFactory,
    emailService: infra.emailService,
    emailObservabilityRepository: repos.emailObservabilityRepository,
    userSuspensionChecker: platform.cachedUserSuspensionChecker,
    userSuspensionCacheInvalidator: platform.cachedUserSuspensionChecker,
    registrationService: userMisc.registrationService,
    invitationService: userMisc.invitationService,
    profileService: userMisc.profileService,
    addressService: userMisc.addressService,
    analyticsService: userMisc.analyticsService,
    domainEventPublisher: platform.domainEventPublisher,
    authAuditPublisher: platform.authAuditPublisher,
    legalEntityLifecycleAdminService: platform.legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService: complianceMedia.legalEntityDocumentAdminService,
    impersonationAuditService: platform.impersonationAuditService,
    impersonationSessionService: platform.impersonationSessionService,
    legalEntityAccessService: platform.legalEntityAccessService,
    requireLegalEntityContext: platform.requireLegalEntityContext,
    requireSubmissionsLegalEntityContext: userMisc.requireSubmissionsLegalEntityContext,
    adminUserService: userMisc.adminUserService,
    adminNavCountsService: admin.adminNavCountsService,
    adminLotsKpiTrendService: admin.adminLotsKpiTrendService,
    adminPaymentsKpiTrendService: admin.adminPaymentsKpiTrendService,
    adminSalesKpiTrendService: admin.adminSalesKpiTrendService,
    adminPayoutsKpiTrendService: admin.adminPayoutsKpiTrendService,
    adminPaymentListQueryService: userMisc.adminPaymentListQueryService,
    adminMetricsService: payments.adminMetricsService,
    attentionFeedReader: repos.attentionFeedReader,
    httpErrorHandler: userMisc.httpErrorHandler,
    itemSubmissionRepository: repos.itemSubmissionRepository,
    itemSubmissionService: catalog.itemSubmissionService,
    legalEntityRepository: repos.legalEntityRepository,
    personalLegalEntityResolver: userMisc.personalLegalEntityResolver,
    legalEntityNotificationRecipients: repos.legalEntityNotificationRecipients,
    kycRepository: repos.kycRepository,
    kycService: complianceMedia.kycService,
    kycResubmissionNotifier: complianceMedia.kycResubmissionNotifier,
    amlService: complianceMedia.amlService,
    sourceOfFundsService: complianceMedia.sourceOfFundsService,
    adminSourceOfFundsQueryService: complianceMedia.adminSourceOfFundsQueryService,
    sourceOfFundsDocumentCollectionService: complianceMedia.sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService: complianceMedia.sourceOfFundsDocumentReviewService,
    organizationOnboardingService: platform.organizationOnboardingService,
    orgModuleGate: userMisc.orgModuleGate,
    organizationOnboardingFlowService: platform.organizationOnboardingFlowService,
    artistRegistryService: platform.artistRegistryService,
    stripeConnectService: platform.stripeConnectService,
    memberManagementService: platform.memberManagementService,
    pendingInvitationsReader: repos.pendingInvitationsReader,
    invitationLifecycleService: platform.invitationLifecycleService,
    transactionalMailer: platform.transactionalMailer,
    payoutRepository: repos.payoutRepository,
    payoutService: platform.payoutService,
    objectStorage: infra.objectStorage,
    mediaUrlResolver: complianceMedia.mediaUrlResolver,
    mediaAssetEnricher: complianceMedia.mediaAssetEnricher,
    uploadService: complianceMedia.uploadService,
    lotDocumentService: complianceMedia.lotDocumentService,
    saleDocumentService: complianceMedia.saleDocumentService,
    submissionDocumentService: complianceMedia.submissionDocumentService,
    uploadValidationQueue: infra.uploadValidationQueue,
    imageCleanupQueue: infra.imageCleanupQueue,
    marketingSyncQueue: infra.marketingSyncQueue,
    payoutStatementQueue: infra.payoutStatementQueue,
    dataExportQueue: infra.dataExportQueue,
    exportService: complianceMedia.exportService,
    legalEntityArchiveQueue: infra.legalEntityArchiveQueue,
    stripePaymentWebhookService: payments.stripePaymentWebhookService,
    stripeClientFactory: infra.stripeClientFactory,
    stripeWebhookVerifier: infra.stripeWebhookVerifier,
    marketingEventService: complianceMedia.marketingEventService,
    marketingEventPublisher: complianceMedia.marketingEventPublisher,
    clickIdStore: complianceMedia.clickIdStore,
    postmarkWebhookService: userMisc.postmarkWebhookService,
    adminMarketingEventsService: userMisc.adminMarketingEventsService,
    emailUnsubscribeService: userMisc.emailUnsubscribeService,
    bidding: createBiddingRouteServices({
      absenteeBidService: biddingSaleroom.absenteeBidService,
      autoBidService: biddingSaleroom.autoBidService,
      conditionReportService: catalog.conditionReportService,
    }),
    admin: admin.admin,
    queueAdmin: userMisc.queueAdmin,
    closeBullQueues: userMisc.closeBullQueues,
  };
}
