import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import { bid, lot, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import {
  CompositeMarketingEventPublisher,
  type IClickIdStore,
  type IMarketingEventPublisher,
  InMemoryCircuitBreaker,
  MetaCapiMarketingEventPublisher,
  SgtmMarketingEventPublisher,
} from "@auction/marketing-events";
import {
  LEGAL_ENTITY_ARCHIVE_JOB_NAME,
  type LegalEntityArchiveQueueProducer,
} from "@auction/queues";
import type { Queue } from "bullmq";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Redis } from "ioredis";
import { createContainerAuth } from "./container/create-auth.js";
import { createInfra } from "./container/create-infra.js";
import { createRepositories } from "./container/create-repositories.js";
import type { Env } from "./env.js";
import { createExportProviderDeps } from "./exports/deps.js";
import { createExportProviders } from "./exports/registry.js";
import { BetterAuthEmailSignupPersister } from "./infrastructure/better-auth-email-signup.persister.js";
import { BullmqMarketingEventQueue } from "./infrastructure/bullmq-marketing-event.queue.js";
import { CachedClickIdStore } from "./infrastructure/cached-click-id.store.js";
import { CachedUserSuspensionChecker } from "./infrastructure/cached-user-suspension.checker.js";
import { CompositeErrorClassifier } from "./infrastructure/composite-error.classifier.js";
import { ConsoleErrorLogger } from "./infrastructure/console-error.logger.js";
import { DrizzleMarketingEventOutboxRepository } from "./infrastructure/drizzle-marketing-event-outbox.repository.js";
import { DrizzleRegistrationCompensator } from "./infrastructure/drizzle-registration.compensator.js";
import { EmailNotificationChannel } from "./infrastructure/email-notification.channel.js";
import { EventMarketingConsentGate } from "./infrastructure/header-marketing-consent.gate.js";
import { InAppNotificationChannel } from "./infrastructure/in-app-notification.channel.js";
import { JsonErrorResponseBuilder } from "./infrastructure/json-error-response.builder.js";
import { NoOpErrorReporter } from "./infrastructure/no-op-error.reporter.js";
import { NoOpPushSender } from "./infrastructure/no-op-push.sender.js";
import { NoOpWelcomeNotifier } from "./infrastructure/no-op-welcome.notifier.js";
import { NoopMarketingEventOutboxRepository } from "./infrastructure/noop-marketing-event-outbox.repository.js";
import { NoopMarketingEventPublisher } from "./infrastructure/noop-marketing-event.publisher.js";
import { NoopMarketingEventQueue } from "./infrastructure/noop-marketing-event.queue.js";
import { PostgresClickIdStore } from "./infrastructure/postgres-click-id.store.js";
import { PushNotificationChannel } from "./infrastructure/push-notification.channel.js";
import { RedisClickIdStore } from "./infrastructure/redis-click-id.store.js";
import { RedisIdempotencyStore } from "./infrastructure/redis-idempotency.store.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import { RedisSaleroomRealtimePublisher } from "./infrastructure/redis-saleroom-realtime.publisher.js";
import { RedisUserNotificationPublisher } from "./infrastructure/redis-user-notification.publisher.js";
import { SentryErrorReporter } from "./infrastructure/sentry-error.reporter.js";
import { createTransactionalMailer } from "./infrastructure/transactional-mailer.js";
import { DrizzleUserProfilePersister } from "./infrastructure/user-profile.persister.js";
import { WebPushSender } from "./infrastructure/web-push.sender.js";
import { WhatsappNotificationChannel } from "./infrastructure/whatsapp-notification.channel.js";
import { ZodRegistrationValidator } from "./infrastructure/zod-registration.validator.js";
import { LotJobScheduler } from "./jobs/lot-job-scheduler.js";
import { DisplayTokenIssuer } from "./lib/display-token.js";
import { createBaseLogger } from "./lib/logger.js";
import { getMarketingEventsConfig } from "./lib/marketing-events-enabled.js";
import { enqueueOrgSubmittedAdminNotice } from "./lib/org-lifecycle-notifications.js";
import { type OrgModuleGate, createOrgModuleGate } from "./lib/org-module-gate.js";
import {
  type PlatformCatalogLegalEntityIdProvider,
  createPlatformCatalogLegalEntityIdProvider,
} from "./lib/platform-catalog-legal-entity.js";
import { queueRuntimeEnvFromApiEnv } from "./lib/queue-runtime-env.js";
import type { IStripeClientFactory } from "./lib/stripe-client.js";
import type { StripeWebhookVerifier } from "./lib/stripe-webhook-verifier.js";
import { VeriffScreeningProvider } from "./lib/veriff/veriff-screening-provider.js";
import { VeriffWatchlistFetcher } from "./lib/veriff/veriff-watchlist-fetcher.js";
import { VeriffWebhookVerifier } from "./lib/veriff/veriff-webhook-verifier.js";
import {
  createRequireLegalEntityContext,
  createSubmissionsLegalEntityContext,
} from "./middleware/require-legal-entity-context.js";
import { DrizzleAdminUserSuspender } from "./repositories/drizzle-admin-user.reader.js";
import { DrizzleLotSoftDeleteSideEffects } from "./repositories/drizzle-lot-soft-delete.side-effects.js";
import { DrizzleSaleSoftDeleteSideEffects } from "./repositories/drizzle-sale-soft-delete.side-effects.js";
import { SalePressArchiveRepository } from "./repositories/sale-press-archive.repository.js";
import { AbsenteeBidService } from "./services/absentee-bid.service.js";
import { NoOpAccountingProvider } from "./services/accounting/no-op-accounting.provider.js";
import { XeroAccountingProvider } from "./services/accounting/xero-accounting.provider.js";
import {
  type IXeroPaymentRecorder,
  XeroPaymentRecorder,
} from "./services/accounting/xero-payment-recorder.js";
import { XeroPayoutBillWriter } from "./services/accounting/xero-payout-bill.writer.js";
import { AddressService } from "./services/address.service.js";
import { AdminMetricsService } from "./services/admin-metrics.service.js";
import { AdminSaleOperationsSnapshotService } from "./services/admin-sale-operations-snapshot.service.js";
import { AdminUserService } from "./services/admin-user.service.js";
import { AdminLotBrowseService } from "./services/admin/admin-lot-browse.service.js";
import { AdminLotsKpiTrendService } from "./services/admin/admin-lots-kpi-trend.service.js";
import { AdminMarketingEventsService } from "./services/admin/admin-marketing-events.service.js";
import { createAdminNavCountsDeps } from "./services/admin/admin-nav-counts.deps.js";
import { AdminNavCountsService } from "./services/admin/admin-nav-counts.service.js";
import { AdminPaymentListQueryService } from "./services/admin/admin-payment-list-query.service.js";
import { AdminPaymentsKpiTrendService } from "./services/admin/admin-payments-kpi-trend.service.js";
import { AdminPayoutsKpiTrendService } from "./services/admin/admin-payouts-kpi-trend.service.js";
import { AdminSalesKpiTrendService } from "./services/admin/admin-sales-kpi-trend.service.js";
import { AdminSourceOfFundsQueryService } from "./services/admin/admin-source-of-funds-query.service.js";
import {
  attachAdminDashboardMetrics,
  createAdminRouteServices,
} from "./services/admin/create-admin-route-services.js";
import { LegalEntityDocumentAdminService } from "./services/admin/legal-entity-document-admin.service.js";
import { StructuredQueueAuditService } from "./services/admin/queue-audit.service.js";
import { BullMQQueueInspector } from "./services/admin/queue-inspector.service.js";
import { BullMQQueueMutator } from "./services/admin/queue-mutator.service.js";
import { DefaultAmlDecisionPolicy } from "./services/aml/aml-decision.policy.js";
import { AmlService } from "./services/aml/aml.service.js";
import { AmlSettlementCompliancePolicy } from "./services/aml/settlement-compliance.policy.js";
import { AnalyticsService } from "./services/analytics.service.js";
import { ArtistDeleteService } from "./services/artist-delete.service.js";
import { ArtistProfileService } from "./services/artist-profile.service.js";
import { ArtistRegistryService } from "./services/artist-registry.service.js";
import { ArtistWatchlistService } from "./services/artist-watchlist.service.js";
import { AuthAuditPublisher } from "./services/auth-audit.publisher.js";
import { AutoBidService } from "./services/auto-bid.service.js";
import { BidEligibilityService } from "./services/bid-eligibility.service.js";
import { BidService } from "./services/bid.service.js";
import { DEFAULT_BID_POLICY } from "./services/bid/bid-policy.js";
import { SaleroomOnBlockPolicy } from "./services/bid/saleroom-on-block.policy.js";
import { CachedCatalogueListService } from "./services/cached-catalogue-list.service.js";
import { CategoryService } from "./services/category.service.js";
import { ConditionReportService } from "./services/condition-report.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import { DefaultMetricsAggregator } from "./services/default-metrics.aggregator.js";
import { DisplayOverlayService } from "./services/display-overlay.service.js";
import { DisplayPairingService } from "./services/display-pairing.service.js";
import { DisplaySnapshotReader } from "./services/display-snapshot-reader.service.js";
import { DomainEventPublisher } from "./services/domain-event.publisher.js";
import { EmailUnsubscribeService } from "./services/email-unsubscribe.service.js";
import { EntityDocumentService } from "./services/entity-document.service.js";
import { ErrorHandlerService } from "./services/error-handler.service.js";
import { ExportService } from "./services/export/export.service.js";
import { ImageCleanupService } from "./services/image-cleanup.service.js";
import { ImpersonationAuditService } from "./services/impersonation-audit.service.js";
import { ImpersonationSessionService } from "./services/impersonation-session.service.js";
import type { AdminRouteServices } from "./services/interfaces/admin-routes.js";
import type { IArtistRegistryService } from "./services/interfaces/artist-registry.js";
import type { IAttentionFeedReader } from "./services/interfaces/attention-feed.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IConditionReportService } from "./services/interfaces/condition-report.js";
import type { IDisplayOverlayService } from "./services/interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "./services/interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "./services/interfaces/display-snapshot-reader.js";
import type { IEmailObservabilityRepository } from "./services/interfaces/email-observability.js";
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
import type { INotificationPreferenceRepository } from "./services/interfaces/notification-preference.js";
import type { IObjectStorage } from "./services/interfaces/object-storage.js";
import type { IOnsiteEventCheckInService } from "./services/interfaces/onsite-event-check-in-service.js";
import type { IOnsiteEventRsvpService } from "./services/interfaces/onsite-event-rsvp-service.js";
import type { IOrganizationOnboardingService } from "./services/interfaces/organization-onboarding.js";
import type { IPayoutRepository } from "./services/interfaces/payout-repository.js";
import type { IPayoutService } from "./services/interfaces/payout.js";
import type { IPendingInvitationsReader } from "./services/interfaces/pending-invitations-reader.js";
import type { IPushSubscriptionRepository } from "./services/interfaces/push.js";
import type { IPushSender } from "./services/interfaces/push.js";
import type { IRateLimitStore } from "./services/interfaces/rate-limit-store.js";
import type { IItemSubmissionRepository } from "./services/interfaces/repositories.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import type { IStripeConnectService } from "./services/interfaces/stripe-connect.js";
import type { ITransactionalMailer } from "./services/interfaces/transactional-mail.js";
import type { IUiPreferenceRepository } from "./services/interfaces/ui-preference.js";
import type {
  IUserSuspensionCacheInvalidator,
  IUserSuspensionChecker,
} from "./services/interfaces/user-suspension.js";
import type { IXeroWebhookEventRepository } from "./services/interfaces/xero-repositories.js";
import { InvitationConsumptionService } from "./services/invitation-consumption.service.js";
import { InvitationLifecycleService } from "./services/invitation-lifecycle.service.js";
import { InvitationService } from "./services/invitation.service.js";
import { InvoiceAddressingService } from "./services/invoice-addressing.js";
import { ItemSubmissionService } from "./services/item-submission.service.js";
import { KycResubmissionNotifier } from "./services/kyc/kyc-resubmission-notifier.js";
import { VeriffKycService } from "./services/kyc/veriff-kyc.service.js";
import { LegalEntityAccessService } from "./services/legal-entity-access.service.js";
import { LegalEntityLifecycleAdminService } from "./services/legal-entity-lifecycle-admin.service.js";
import { EnsurePersonalLegalEntityService } from "./services/legal-entity/ensure-personal-legal-entity.service.js";
import { PersonalLegalEntityResolver } from "./services/legal-entity/personal-legal-entity-resolver.service.js";
import { LotFulfilmentService } from "./services/lot-fulfilment.service.js";
import { LotInvoiceInitiationService } from "./services/lot-invoice-initiation.service.js";
import { LotLifecycleEventRecorder } from "./services/lot-lifecycle-event-recorder.js";
import { LotLifecycleQueryService } from "./services/lot-lifecycle-query.service.js";
import { LotLifecycleRecording } from "./services/lot-lifecycle-recording.service.js";
import { LotLifecycleService } from "./services/lot-lifecycle.service.js";
import { LotNotificationCoordinator } from "./services/lot-notification-coordinator.js";
import { LotSoftDeleteService } from "./services/lot-soft-delete.service.js";
import { LotTransitionOrchestrator } from "./services/lot-transition-orchestrator.js";
import { LotService } from "./services/lot.service.js";
import { MarketingEventService } from "./services/marketing-event.service.js";
import { MediaAssetEnricher } from "./services/media-asset-enricher.js";
import { MediaUrlResolver } from "./services/media-url-resolver.js";
import { MemberManagementService } from "./services/member-management.service.js";
import { EmailMembershipInviteNotifier } from "./services/membership-invite-notifier.js";
import { NotificationOutboxProcessor } from "./services/notification-outbox.processor.js";
import { NotificationOutboxService } from "./services/notification-outbox.service.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { NotificationDispatcher } from "./services/notification.dispatcher.js";
import { NotificationFactory } from "./services/notification.factory.js";
import { NotificationService } from "./services/notification.service.js";
import { OnsiteEventCheckInService } from "./services/onsite-event-check-in.service.js";
import { OnsiteEventNotifier } from "./services/onsite-event-notifier.js";
import { OnsiteEventRsvpService } from "./services/onsite-event-rsvp.service.js";
import { OrganizationOnboardingService } from "./services/organization-onboarding.service.js";
import { OrganizationOnboardingFlowService } from "./services/organization-onboarding/organization-onboarding-flow.service.js";
import { PaddleService } from "./services/paddle.service.js";
import { PassQrRenderService } from "./services/pass-qr-render.service.js";
import { PaymentService } from "./services/payment.service.js";
import { BankTransferCheckoutRail } from "./services/payment/bank-transfer-checkout.rail.js";
import { CardCheckoutRail } from "./services/payment/card-checkout.rail.js";
import { PaymentCaptureService } from "./services/payment/payment-capture.service.js";
import { PaymentRefundReconcileService } from "./services/payment/payment-refund-reconcile.service.js";
import {
  PaymentTierPolicy,
  parsePaymentTierLimits,
} from "./services/payment/payment-tier.policy.js";
import { PlatformFeePolicy } from "./services/payment/platform-fee.policy.js";
import { StripeCheckoutService } from "./services/payment/stripe-checkout.service.js";
import { PayoutService } from "./services/payout.service.js";
import { PayoutAdjustmentService } from "./services/payout/payout-adjustment.service.js";
import { PostmarkWebhookService } from "./services/postmark-webhook.service.js";
import { PressArchiveReadService } from "./services/press-archive-read.service.js";
import { ProfileService } from "./services/profile.service.js";
import { QrCodeAnalyticsService } from "./services/qr-code-analytics.service.js";
import { QrCodeService } from "./services/qr-code.service.js";
import { QuietHoursChecker } from "./services/quiet-hours.checker.js";
import { RegistrationService } from "./services/registration.service.js";
import { SaleBiddersService } from "./services/sale-bidders.service.js";
import { SaleFollowService } from "./services/sale-follow.service.js";
import { SaleLifecycleService } from "./services/sale-lifecycle.service.js";
import { SaleListReadService } from "./services/sale-list-read.service.js";
import { SaleRegistrationService } from "./services/sale-registration.service.js";
import { SaleSoftDeleteService } from "./services/sale-soft-delete.service.js";
import { SaleStatusTransitionService } from "./services/sale-status-transition.service.js";
import { SaleService } from "./services/sale.service.js";
import { SaleroomCheckInService } from "./services/saleroom-check-in.service.js";
import { SaleroomService } from "./services/saleroom.service.js";
import { SavedSearchService } from "./services/saved-search.service.js";
import { SessionRevocationService } from "./services/session-revocation.service.js";
import { PerRequestSigningPolicy, StableSigningPolicy } from "./services/signed-url-policy.js";
import { SourceOfFundsDocumentCollectionService } from "./services/source-of-funds/source-of-funds-document-collection.service.js";
import { SourceOfFundsDocumentReviewService } from "./services/source-of-funds/source-of-funds-document-review.service.js";
import { SourceOfFundsService } from "./services/source-of-funds/source-of-funds.service.js";
import { StripePaymentWebhookService } from "./services/stripe-payment-webhook.service.js";
import { StripeConnectFacade } from "./services/stripe/stripe-connect.facade.js";
import { StripeCustomerGateway } from "./services/stripe/stripe-customer.gateway.js";
import { StripePaymentGateway } from "./services/stripe/stripe-payment-gateway.js";
import { TelephoneBidBookingService } from "./services/telephone-bid-booking.service.js";
import { TelephoneBookingNotifier } from "./services/telephone-booking-notifier.js";
import { UiPreferenceService } from "./services/ui-preference.service.js";
import { UploadService } from "./services/upload.service.js";
import { UserDashboardReadService } from "./services/user-dashboard-read.service.js";
import { UserService } from "./services/user.service.js";
import { VenueService } from "./services/venue.service.js";
import { WatchlistService } from "./services/watchlist.service.js";
import { XeroOAuthService } from "./services/xero-oauth.service.js";
import { LotStrategyFactory } from "./strategies/strategy.factory.js";

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
  saleListReadService: SaleListReadService;
  pressArchiveReadService: PressArchiveReadService;
  venueService: VenueService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  saleSoftDeleteService: SaleSoftDeleteService;
  lotSoftDeleteService: LotSoftDeleteService;
  saleFollowService: SaleFollowService;
  saleBiddersService: SaleBiddersService;
  saleRegistrationService: SaleRegistrationService;
  lotLifecycleService: LotLifecycleService;
  lotLifecycleQueryService: LotLifecycleQueryService;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  adminLotBrowseService: AdminLotBrowseService;
  absenteeBidService: AbsenteeBidService;
  telephoneBidBookingService: TelephoneBidBookingService;
  paddleService: PaddleService;
  saleroomCheckInService: SaleroomCheckInService;
  onsiteEventRsvpService: IOnsiteEventRsvpService;
  onsiteEventCheckInService: IOnsiteEventCheckInService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomService: SaleroomService;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  displaySnapshotReader: IDisplaySnapshotReader;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  lotFulfilmentService: LotFulfilmentService;
  saleLifecycleService: SaleLifecycleService;
  lotJobScheduler: ILotJobScheduler;
  saleStatusTransitionService: SaleStatusTransitionService;
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
  notificationOutboxProcessor: NotificationOutboxProcessor;
  notificationFactory: NotificationFactory;
  emailService: IEmailService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  userSuspensionChecker: IUserSuspensionChecker;
  userSuspensionCacheInvalidator: IUserSuspensionCacheInvalidator;
  registrationService: RegistrationService;
  invitationService: InvitationService;
  profileService: ProfileService;
  addressService: AddressService;
  analyticsService: AnalyticsService;
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
  adminLotsKpiTrendService: AdminLotsKpiTrendService;
  adminPaymentsKpiTrendService: AdminPaymentsKpiTrendService;
  adminSalesKpiTrendService: AdminSalesKpiTrendService;
  adminPayoutsKpiTrendService: AdminPayoutsKpiTrendService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  httpErrorHandler: ErrorHandlerService;
  itemSubmissionRepository: IItemSubmissionRepository;
  itemSubmissionService: IItemSubmissionService;
  /** legal entity repository (membership + acting context). */
  legalEntityRepository: ILegalEntityRepository;
  /** Lazily provisions personal legal entities for client flows. */
  personalLegalEntityResolver: PersonalLegalEntityResolver;
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
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
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
  const {
    redis,
    rateLimitStore,
    cache,
    bullConnection,
    emailQueue,
    emailService,
    getPublicJwks,
    objectStorage,
    stripeClientFactory,
    stripeWebhookVerifier,
    uploadValidationQueue,
    imageCleanupQueue,
    qrCodeScanQueue,
    marketingSyncQueue,
    marketingEventsBullQueue,
    payoutStatementQueue,
    dataExportQueue,
    legalEntityArchiveQueue,
  } = infra;

  const sessionRevocation = new SessionRevocationService(authDb);
  const ensurePersonalLegalEntityService = new EnsurePersonalLegalEntityService(db);
  const { auth, authenticator } = createContainerAuth({
    env,
    db,
    authDb,
    emailService,
    sessionRevocation,
    ensurePersonalLegalEntityService,
  });

  const repos = createRepositories(db);
  const {
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
  } = repos;

  const domainEventPublisher = new DomainEventPublisher();
  const lotLifecycleEventRecorder = new LotLifecycleEventRecorder(domainEventPublisher);
  const lotLifecycleRecording = new LotLifecycleRecording(lotLifecycleEventRecorder);
  const authAuditPublisher = new AuthAuditPublisher(domainEventPublisher);
  const organizationOnboardingService: IOrganizationOnboardingService =
    new OrganizationOnboardingService(db, domainEventPublisher);
  const impersonationAuditService = new ImpersonationAuditService(db, domainEventPublisher);
  const impersonationSessionService = new ImpersonationSessionService(db);
  const legalEntityAccessService = new LegalEntityAccessService(
    legalEntityRepository,
    impersonationSessionService,
    impersonationAuditService,
  );
  const requireLegalEntityContext = createRequireLegalEntityContext(legalEntityRepository, {
    impersonationSessions: impersonationSessionService,
    onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
  });
  const artistRegistryService: IArtistRegistryService = new ArtistRegistryService(
    db,
    domainEventPublisher,
  );
  const memberManagementService: IMemberManagementService = new MemberManagementService(
    db,
    domainEventPublisher,
    repoFactory,
  );
  const transactionalMailer: ITransactionalMailer = createTransactionalMailer(env);
  const membershipInviteNotifier = new EmailMembershipInviteNotifier(transactionalMailer);
  const invitationLifecycleService: IInvitationLifecycleService = new InvitationLifecycleService(
    db,
    domainEventPublisher,
    membershipInviteNotifier,
    env.WEB_ORIGIN,
  );
  const payoutAdjustmentService = new PayoutAdjustmentService(db, payoutRepository);
  const payoutService: IPayoutService = new PayoutService(
    payoutRepository,
    db,
    domainEventPublisher,
    payoutAdjustmentService,
  );
  const stripeConnectService: IStripeConnectService = new StripeConnectFacade(
    env,
    db,
    payoutService,
    payoutRepository,
    domainEventPublisher,
    stripeClientFactory,
    redis,
  );

  const organizationOnboardingFlowService = new OrganizationOnboardingFlowService(
    db,
    legalEntityRepository,
    organizationOnboardingService,
    domainEventPublisher,
    stripeConnectService,
    {
      onSubmittedForReview: async ({ legalEntityId, displayName }) => {
        const staffRows = await db
          .select({ email: user.email })
          .from(user)
          .where(and(eq(user.role, "staff"), isNull(user.suspendedAt)));
        const adminRecipients = staffRows.map((r) => r.email).filter(Boolean);
        if (adminRecipients.length === 0) return;
        const webOrigin = env.WEB_ORIGIN.replace(/\/$/, "");
        await enqueueOrgSubmittedAdminNotice({
          db,
          emailService,
          legalEntityId,
          entityDisplayName: displayName,
          adminRecipients,
          adminOnboardingUrl: `${webOrigin}/admin/onboarding-issues`,
          supportContactEmail: env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
          eventId: Date.now(),
        });
      },
    },
  );
  const legalEntityLifecycleAdminService = new LegalEntityLifecycleAdminService(
    db,
    domainEventPublisher,
    {
      enqueueArchiveCascade: async (legalEntityId: string) => {
        await legalEntityArchiveQueue.add(
          LEGAL_ENTITY_ARCHIVE_JOB_NAME,
          { legalEntityId },
          { removeOnComplete: 200, attempts: 3, backoff: { type: "exponential", delay: 2000 } },
        );
      },
      onApproveToConnectPending: async (legalEntityId: string) => {
        if (stripeConnectService.isConfigured()) {
          await stripeConnectService.syncAccountFromStripe(legalEntityId);
        }
      },
      emailService,
      webOrigin: env.WEB_ORIGIN,
      supportContactEmail: env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    },
  );

  const paymentRefundReconcileService = new PaymentRefundReconcileService(
    db,
    paymentRepo,
    payoutAdjustmentService,
    domainEventPublisher,
    paymentRefundReconcileRepository,
  );
  const uiPreferenceService = new UiPreferenceService(uiPreferenceRepository);
  const invoiceAddressingService = new InvoiceAddressingService(
    paymentRepo,
    legalEntityRepository,
    profileRepo,
    addressRepo,
    createBaseLogger(env).child({ component: "invoice_addressing" }),
  );
  const cachedUserSuspensionChecker = new CachedUserSuspensionChecker(userSuspensionChecker, cache);
  const cachedCatalogueListService = new CachedCatalogueListService(cache, 20);
  const notifier = new RedisNotificationSender(redis);
  const userNotificationPublisher = new RedisUserNotificationPublisher(redis);
  const notificationService = new NotificationService(notifier, notifier);
  const strategyFactory = new LotStrategyFactory();
  const notificationFactory = new NotificationFactory();

  const quietHoursChecker = new QuietHoursChecker();
  const pushSender: IPushSender =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
      : new NoOpPushSender();

  const inAppChannel = new InAppNotificationChannel(
    notificationWriteRepo,
    userNotificationPublisher,
    cache,
  );
  const pushChannel = new PushNotificationChannel(pushSender, pushSubscriptionRepository);
  const emailChannel = new EmailNotificationChannel(
    emailService,
    userRepo,
    env.WEB_ORIGIN,
    env.EMAIL_UNSUBSCRIBE_SECRET,
  );
  const channels = env.ENABLE_WHATSAPP_CHANNEL
    ? [inAppChannel, pushChannel, emailChannel, new WhatsappNotificationChannel()]
    : [inAppChannel, pushChannel, emailChannel];
  const notificationDispatcher = new NotificationDispatcher(
    channels,
    notificationPreferenceRepository,
    quietHoursChecker,
  );
  const notificationOutboxService = new NotificationOutboxService(notificationOutboxRepository);
  const notificationOutboxProcessor = new NotificationOutboxProcessor(
    notificationOutboxRepository,
    notificationDispatcher,
  );

  const lotLifecycleHooks: { onLotActivated: ((lotId: string) => Promise<void>) | null } = {
    onLotActivated: null,
  };
  const lotLifecycleService = new LotLifecycleService(
    repoFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
    antiShillingGuard,
    domainEventPublisher,
    async (lotId) => {
      await lotLifecycleHooks.onLotActivated?.(lotId);
    },
    lotLifecycleRecording,
    notificationService,
    notificationOutboxService,
    saleroomSessionLookup,
    saleRepo,
  );

  const saleLifecycleService = new SaleLifecycleService(saleRepo, lotRepo);

  const marketingConfig = getMarketingEventsConfig(env);
  const marketingEnabled = marketingConfig !== undefined;
  const clickIdStore: IClickIdStore = marketingEnabled
    ? new CachedClickIdStore(new PostgresClickIdStore(db), new RedisClickIdStore(redis))
    : new RedisClickIdStore(redis);
  const marketingOutbox = marketingEnabled
    ? new DrizzleMarketingEventOutboxRepository(db)
    : new NoopMarketingEventOutboxRepository();
  const marketingConsentGate = new EventMarketingConsentGate();
  const marketingEventQueue = marketingEnabled
    ? new BullmqMarketingEventQueue(marketingEventsBullQueue)
    : new NoopMarketingEventQueue();
  const marketingEventPublisher: IMarketingEventPublisher = marketingConfig
    ? new CompositeMarketingEventPublisher(
        new SgtmMarketingEventPublisher(
          marketingConfig.sgtmEndpointUrl,
          marketingConfig.ga4MeasurementId,
        ),
        new MetaCapiMarketingEventPublisher(
          marketingConfig.metaPixelId,
          marketingConfig.metaCapiAccessToken,
          marketingConfig.metaCapiTestEventCode,
          marketingConfig.metaGraphApiVersion,
        ),
        new InMemoryCircuitBreaker(),
      )
    : new NoopMarketingEventPublisher();
  const marketingEventService = new MarketingEventService(
    marketingOutbox,
    marketingEventQueue,
    marketingConsentGate,
  );
  const kycService: IKycService = new VeriffKycService(
    env,
    kycRepository,
    db,
    marketingEventService,
  );
  const kycResubmissionNotifier = new KycResubmissionNotifier(
    userRepo,
    emailService,
    notificationWriteRepo,
    env.WEB_ORIGIN,
  );
  const amlService = new AmlService(
    db,
    new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET),
    new DefaultAmlDecisionPolicy(),
    amlScreeningRepository,
    amlScreeningRepository,
    amlHoldStore,
    domainEventPublisher,
    VeriffScreeningProvider.fromEnv(env),
    VeriffWatchlistFetcher.fromEnv(env),
  );
  const sourceOfFundsService = new SourceOfFundsService(
    sourceOfFundsRepository,
    {
      thresholdAmount: env.SOF_THRESHOLD_AMOUNT,
      currency: env.SOF_THRESHOLD_CURRENCY,
      approvalValidityDays: env.SOF_APPROVAL_VALIDITY_DAYS,
    },
    db,
    domainEventPublisher,
  );
  const exportProviderDeps = createExportProviderDeps(db);
  const exportProviders = createExportProviders(exportProviderDeps);
  const exportService = new ExportService(
    db,
    redis,
    objectStorage,
    dataExportQueue,
    exportProviders,
    {
      syncMaxRows: env.EXPORT_SYNC_MAX_ROWS,
      staleProcessingMs: env.EXPORT_STALE_PROCESSING_MS,
    },
    domainEventPublisher,
  );
  const mediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new PerRequestSigningPolicy(env.SIGNED_GET_TTL_SEC),
  );
  const adminSourceOfFundsQueryService = new AdminSourceOfFundsQueryService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    db,
    mediaUrlResolver,
  );
  const sourceOfFundsDocumentCollectionService = new SourceOfFundsDocumentCollectionService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    db,
    domainEventPublisher,
    objectStorage,
    new PerRequestSigningPolicy(env.SOF_DOWNLOAD_TTL_SEC),
  );
  const sourceOfFundsDocumentReviewService = new SourceOfFundsDocumentReviewService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    db,
    domainEventPublisher,
  );
  const catalogueMediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new StableSigningPolicy(Math.max(env.SIGNED_GET_TTL_SEC, 86_400)),
  );
  const mediaAssetEnricher = new MediaAssetEnricher(db, objectStorage);
  const legalEntityDocumentAdminService = new LegalEntityDocumentAdminService(
    db,
    objectStorage,
    mediaUrlResolver,
  );
  const imageCleanupService = new ImageCleanupService(objectStorage, imageCleanupQueue);
  const uploadService = new UploadService(
    objectStorage,
    db,
    redis,
    uploadValidationQueue,
    mediaUrlResolver,
  );
  const lotDocumentService = new EntityDocumentService(
    "lot",
    lotDocumentRepo,
    db,
    objectStorage,
    mediaUrlResolver,
  );
  const saleDocumentService = new EntityDocumentService(
    "sale",
    saleDocumentRepo,
    db,
    objectStorage,
    mediaUrlResolver,
  );
  const submissionDocumentService = new EntityDocumentService(
    "submission",
    submissionDocumentRepo,
    db,
    objectStorage,
    mediaUrlResolver,
  );
  const lotJobScheduler: ILotJobScheduler = new LotJobScheduler(
    bullConnection,
    (lotId) => lotLifecycleService.processActivateJob(lotId),
    (lotId) => lotLifecycleService.processEndJob(lotId),
  );

  const lotTransitionOrchestrator = new LotTransitionOrchestrator(
    db,
    lotLifecycleEventRecorder,
    lotRepo,
    lotJobScheduler,
  );
  const lotLifecycleQueryService = new LotLifecycleQueryService(db);
  const adminLotBrowseService = new AdminLotBrowseService(db);
  const qrCodeService = new QrCodeService(
    db,
    redis,
    env.WEB_ORIGIN,
    createBaseLogger(env).child({ component: "qr_code" }),
    qrCodeScanQueue,
  );
  const qrCodeAnalytics = new QrCodeAnalyticsService(db);

  const lotNotificationCoordinator = new LotNotificationCoordinator(
    notificationWriteRepo,
    userNotificationPublisher,
  );

  const telephoneBookingNotifier = new TelephoneBookingNotifier(
    db,
    transactionalMailer,
    notificationWriteRepo,
    env.WEB_ORIGIN,
    env.OPS_SUPPORT_EMAIL,
  );
  const telephoneBidBookingService = new TelephoneBidBookingService(
    db,
    telephoneBidBookingRepo,
    legalEntityRepository,
    kycService,
    amlHoldStore,
    domainEventPublisher,
    telephoneBookingNotifier,
  );

  const SELF_SERVICE_BID_WINDOW_MS = 30 * 60_000;
  const paddleService = new PaddleService(paddleRepo, db, cache, async (saleId, userId) => {
    const cutoff = new Date(Date.now() - SELF_SERVICE_BID_WINDOW_MS);
    const rows = await db
      .select({ id: bid.id })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(lot.saleId, saleId),
          eq(bid.bidderId, userId),
          or(eq(bid.placedVia, "web"), isNull(bid.placedVia)),
          gt(bid.createdAt, cutoff),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });

  const saleroomCheckInService = new SaleroomCheckInService(
    db,
    saleroomCheckInRepo,
    legalEntityRepository,
    paddleService,
  );

  const passQrRenderService = new PassQrRenderService();
  const onsiteEventLog = createBaseLogger(env).child({ component: "onsite_event" });
  const onsiteEventNotifier = new OnsiteEventNotifier(
    transactionalMailer,
    passQrRenderService,
    env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    onsiteEventLog.child({ module: "notifier" }),
  );
  const onsiteEventRsvpService = new OnsiteEventRsvpService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventClientReader,
    onsiteEventNotifier,
    env.CHECK_IN_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
    onsiteEventLog.child({ module: "rsvp" }),
  );
  const onsiteEventCheckInService = new OnsiteEventCheckInService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    passQrRenderService,
    onsiteEventLog.child({ module: "check_in" }),
  );

  const lotService = new LotService({
    lotRepo,
    saleRepo,
    bids: repoFactory.root.bid,
    watchlist: watchlistRepo,
    jobScheduler: lotJobScheduler,
    lotNotifications: lotNotificationCoordinator,
    imageCleanup: imageCleanupService,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    enforceIndividualConnectOnPublish: stripeConnectService.isConfigured(),
    db,
    domainEventPublisher,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    lotLifecycleRecording,
    lotTransitionOrchestrator,
    qrCodeService,
    telephoneBidBookingService,
    repoFactory,
  });

  const conditionReportService = new ConditionReportService(
    db,
    lotRepo,
    legalEntityRepository,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
  );

  const saleFollowService = new SaleFollowService(saleFollowRepo, saleRepo);
  const resolvePlatformCatalogLegalEntityId = createPlatformCatalogLegalEntityIdProvider({
    db,
    configuredId: env.PLATFORM_CATALOG_LEGAL_ENTITY_ID,
  });
  const saleService = new SaleService({
    saleRepo,
    lotRepo,
    jobScheduler: lotJobScheduler,
    resolvePlatformCatalogLegalEntityId,
    imageCleanup: imageCleanupService,
    saleFollowReader: saleFollowService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    db,
    domainEventPublisher,
    lotLifecycleRecording,
    legalEntityRepository,
    venueRepository: venueRepo,
    enforceIndividualConnectOnPublish: stripeConnectService.isConfigured(),
    qrCodeService,
    repoFactory,
  });
  const saleListReadService = new SaleListReadService(
    saleRepo,
    lotRepo,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
  );
  const pressArchiveReadService = new PressArchiveReadService(
    new SalePressArchiveRepository(saleRepo),
  );
  const saleSoftDeleteSideEffects = new DrizzleSaleSoftDeleteSideEffects(db, lotLifecycleRecording);
  const saleSoftDeleteService = new SaleSoftDeleteService(
    saleRepo,
    lotRepo,
    saleSoftDeleteSideEffects,
    lotJobScheduler,
    db,
    domainEventPublisher,
  );
  const lotSoftDeleteSideEffects = new DrizzleLotSoftDeleteSideEffects(db, lotLifecycleRecording);
  const lotSoftDeleteService = new LotSoftDeleteService(
    lotRepo,
    saleRepo,
    lotSoftDeleteSideEffects,
    lotJobScheduler,
    db,
    domainEventPublisher,
  );
  const saleStatusTransitionService = new SaleStatusTransitionService(
    saleRepo,
    lotRepo,
    lotJobScheduler,
    db,
    domainEventPublisher,
    lotLifecycleRecording,
    legalEntityRepository,
    stripeConnectService.isConfigured(),
    repoFactory,
  );

  const saleBiddersService = new SaleBiddersService(saleBiddersReader, saleRepo);
  const itemSubmissionService = new ItemSubmissionService(
    db,
    itemSubmissionRepository,
    userRepo,
    notificationDispatcher,
    imageCleanupService,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    domainEventPublisher,
    mediaUrlResolver,
    mediaAssetEnricher,
    lotLifecycleRecording,
    repoFactory,
  );

  const categoryService = new CategoryService(categoryRepo, db, domainEventPublisher);
  const venueService = new VenueService(venueRepo, db, domainEventPublisher);
  const artistProfileService = new ArtistProfileService(artistProfileRepo, artistRegistryService);
  const artistDeleteService = new ArtistDeleteService(
    artistProfileRepo,
    artistProfileRepo,
    db,
    domainEventPublisher,
  );
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);

  const errorReporter = env.SENTRY_DSN_API ? new SentryErrorReporter() : new NoOpErrorReporter();

  const xeroEnvEnabled = Boolean(
    env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI,
  );

  const platformFeePolicy = new PlatformFeePolicy(legalEntityRepository);

  const paymentTierPolicy = new PaymentTierPolicy(parsePaymentTierLimits(env));

  const accountingProvider: IInvoiceAccountingProvider = xeroEnvEnabled
    ? new XeroAccountingProvider(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_DEFAULT_REVENUE_ACCOUNT_CODE: env.XERO_DEFAULT_REVENUE_ACCOUNT_CODE,
          XERO_DEFAULT_TAX_TYPE: env.XERO_DEFAULT_TAX_TYPE,
          XERO_INVOICE_DUE_DAYS: env.XERO_INVOICE_DUE_DAYS,
          XERO_USE_LEGAL_ENTITY_CONTACT: env.XERO_USE_LEGAL_ENTITY_CONTACT,
        },
        xeroConnRepo,
        paymentExtRepo,
        legalEntityRepository,
        invoiceAddressingService,
        errorReporter,
        redis,
      )
    : new NoOpAccountingProvider();

  const xeroPayoutBillWriter: XeroPayoutBillWriter | null = xeroEnvEnabled
    ? new XeroPayoutBillWriter(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_DEFAULT_TAX_TYPE: env.XERO_DEFAULT_TAX_TYPE,
          XERO_PAYOUT_BILL_ACCOUNT_CODE: env.XERO_PAYOUT_BILL_ACCOUNT_CODE,
        },
        xeroConnRepo,
        payoutRepository,
        legalEntityRepository,
        errorReporter,
        redis,
      )
    : null;

  const stripePaymentGateway = new StripePaymentGateway(env, stripeClientFactory);

  const xeroPaymentRecorder = xeroEnvEnabled
    ? new XeroPaymentRecorder(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_PAYMENT_BANK_ACCOUNT_CODE: env.XERO_PAYMENT_BANK_ACCOUNT_CODE,
        },
        xeroConnRepo,
        paymentExtRepo,
        errorReporter,
        redis,
      )
    : null;

  const lotFulfilmentService = new LotFulfilmentService(db);

  const paymentCaptureService = new PaymentCaptureService(
    db,
    paymentRepo,
    lotRepo,
    userRepo,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    legalEntityNotificationRecipients,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    marketingEventService,
    xeroPaymentRecorder,
    stripePaymentGateway,
  );
  const stripeCustomerGateway = new StripeCustomerGateway(
    env,
    legalEntityRepository,
    stripeClientFactory,
  );

  const stripeCheckoutService = stripePaymentGateway.isConfigured()
    ? new StripeCheckoutService([
        new CardCheckoutRail(env, stripePaymentGateway, paymentRepo, mediaUrlResolver),
        new BankTransferCheckoutRail(
          env,
          stripePaymentGateway,
          stripeCustomerGateway,
          paymentRepo,
          mediaUrlResolver,
        ),
      ])
    : null;

  const settlementCompliancePolicy = new AmlSettlementCompliancePolicy(
    amlHoldStore,
    sourceOfFundsService,
  );
  const paymentService = new PaymentService(
    lotRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
    userRepo,
    accountingProvider,
    paymentTierPolicy,
    legalEntityRepository,
    db,
    domainEventPublisher,
    stripePaymentGateway,
    mediaUrlResolver,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    saleRepo,
    marketingEventService,
    platformFeePolicy,
    paymentCaptureService,
    stripeCheckoutService,
    payoutAdjustmentService,
    paymentRefundReconcileService,
    xeroPaymentRecorder,
    addressRepo,
    settlementCompliancePolicy,
    env.XERO_INVOICE_BLOCKING,
  );

  const lotInvoiceInitiationService = new LotInvoiceInitiationService(
    lotRepo,
    saleRepo,
    paymentRepo,
    settlementCompliancePolicy,
    paymentTierPolicy,
    platformFeePolicy,
    accountingProvider,
    notificationOutboxService,
    notificationFactory,
    domainEventPublisher,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    legalEntityRepository,
    userRepo,
    db,
  );

  const stripePaymentWebhookServiceResolved: StripePaymentWebhookService | null =
    env.STRIPE_SECRET_KEY && env.STRIPE_PAYMENTS_WEBHOOK_SECRET
      ? new StripePaymentWebhookService(
          db,
          paymentRepo,
          payoutRepository,
          payoutAdjustmentService,
          paymentCaptureService,
          domainEventPublisher,
        )
      : null;

  const xeroOAuthService = xeroEnvEnabled ? new XeroOAuthService(redis, env, xeroConnRepo) : null;

  const adminMetricsService = new AdminMetricsService(
    repoFactory,
    redis,
    itemSubmissionService,
    paymentService,
  );

  const saleRegistrationService = new SaleRegistrationService(db, legalEntityRepository);
  const bidEligibilityService = new BidEligibilityService(db, kycService, amlHoldStore);

  const bidIdempotencyStore = new RedisIdempotencyStore(redis);
  const bidService = new BidService({
    repos: repoFactory,
    strategyFactory,
    cache,
    notifications: notificationService,
    lotJobs: lotJobScheduler,
    adminMetrics: adminMetricsService,
    saleModeLookup,
    saleroomSessionLookup,
    antiShillingGuard,
    domainEventPublisher,
    legalEntityRepository,
    idempotencyStore: bidIdempotencyStore,
    bidEligibility: bidEligibilityService,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    lotLifecycleRecording,
    bidPolicy: {
      ...DEFAULT_BID_POLICY,
      antiSnipingWindowMs: env.ANTI_SNIPING_WINDOW_MS,
      antiSnipingExtensionMs: env.ANTI_SNIPING_EXTENSION_MS,
    },
    notificationOutbox: notificationOutboxService,
    notificationFactory,
    saleRepo,
  });
  const absenteeBidService = new AbsenteeBidService(db, bidService, lotRepo, legalEntityRepository);
  const adminSaleOperationsSnapshotService = new AdminSaleOperationsSnapshotService(
    db,
    saleRegistrationService,
    telephoneBidBookingService,
  );
  const autoBidService = new AutoBidService({
    repos: repoFactory,
    bidPlacer: bidService,
    bidPlacerWithIdempotency: bidService,
    bidEligibility: bidEligibilityService,
    legalEntityRepository,
    notifications: notificationService,
  });
  lotLifecycleHooks.onLotActivated = (lotId) => absenteeBidService.replayScheduledForLot(lotId);
  const displayTokenIssuer = new DisplayTokenIssuer();
  const saleroomRealtimePublisher = new RedisSaleroomRealtimePublisher(redis);
  const saleroomService = new SaleroomService({
    db,
    redis,
    lotLifecycle: lotLifecycleService,
    saleRepo,
    lotRepo,
    lotJobs: lotJobScheduler,
    telephoneBidBookingService,
    displayPublisher: saleroomRealtimePublisher,
  });
  const displayPairingService = new DisplayPairingService({
    pairingRepo: displayPairingRepository,
    saleRepo,
    tokenIssuer: displayTokenIssuer,
    redis,
    domainEvents: domainEventPublisher,
    db,
  });
  const displayOverlayService = new DisplayOverlayService({
    db,
    publisher: saleroomRealtimePublisher,
    domainEvents: domainEventPublisher,
  });
  const displaySnapshotReader = new DisplaySnapshotReader({
    db,
    mediaUrlResolver,
  });
  const saleroomOnBlockPolicy = new SaleroomOnBlockPolicy(db);
  const userService = new UserService(userRepo, db, domainEventPublisher);
  const personalLegalEntityResolver = new PersonalLegalEntityResolver(
    legalEntityRepository,
    ensurePersonalLegalEntityService,
    userService,
  );
  const requireSubmissionsLegalEntityContext = createSubmissionsLegalEntityContext(
    legalEntityRepository,
    {
      impersonationSessions: impersonationSessionService,
      onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
      resolvePersonalEntity: (userId) => personalLegalEntityResolver.resolveForUser(userId),
    },
  );
  const watchlistService = new WatchlistService(watchlistRepo, lotRepo, db, marketingEventService);
  const userDashboardReadService = new UserDashboardReadService(
    dashboardQueryService,
    watchlistService,
    mediaUrlResolver,
    saleService,
    mediaAssetEnricher,
  );
  const savedSearchService = new SavedSearchService(db);
  // Watchlist now references `artist_profile.id` (post-0046 migration), so the
  // existence check delegates to the artist registry instead of the user table.
  const artistWatchlistService = new ArtistWatchlistService(artistWatchlistRepo, {
    findById: async (id: string) => {
      const a = await artistProfileService.getById(id);
      return a ? { id: a.id } : null;
    },
  });
  const profileService = new ProfileService(profileRepo, profileRepo, imageCleanupService);
  const addressService = new AddressService(addressRepo);

  const invitationService = new InvitationService(
    invitationRepository,
    userRepo,
    emailService,
    env.WEB_ORIGIN,
  );
  const invitationConsumptionService = new InvitationConsumptionService(invitationRepository);

  const registrationService = new RegistrationService(
    new ZodRegistrationValidator(),
    new BetterAuthEmailSignupPersister(auth, env.WEB_ORIGIN),
    new DrizzleUserProfilePersister(db),
    new NoOpWelcomeNotifier(),
    invitationConsumptionService,
    new DrizzleRegistrationCompensator(authDb),
  );

  const metricsAggregator = new DefaultMetricsAggregator();
  const analyticsService = new AnalyticsService(
    lotMetrics,
    paymentMetrics,
    userMetrics,
    metricsAggregator,
  );
  const orgModuleGate = createOrgModuleGate(env.WEB_ORIGIN);

  const adminSuspender = new DrizzleAdminUserSuspender(db, sessionRevocation, {
    emailService,
    authAudit: authAuditPublisher,
    accountSuspendedSupportEmail: env.EMAIL_REPLY_TO?.trim() || "support@lax.bid",
  });
  const adminUserService = new AdminUserService(
    adminUserReader,
    adminRoleManager,
    adminSuspender,
    adminActivityReader,
    adminUserBidsReader,
    adminUserKycReader,
    cachedUserSuspensionChecker,
  );

  const httpErrorHandler = new ErrorHandlerService(
    new CompositeErrorClassifier(),
    new ConsoleErrorLogger(env),
    errorReporter,
    new JsonErrorResponseBuilder(),
  );

  const queueAudit = new StructuredQueueAuditService(createBaseLogger(env));
  const queueInspector = new BullMQQueueInspector(
    bullConnection,
    redis,
    queueRuntimeEnvFromApiEnv(env),
  );
  const queueMutator = new BullMQQueueMutator(bullConnection, redis, db, queueAudit, env.APP_ENV);
  const queueAdmin = {
    inspector: queueInspector,
    mutator: queueMutator,
    close: async () => {
      await Promise.allSettled([queueInspector.close(), queueMutator.close()]);
    },
  };

  const closeBullQueues = async () => {
    await Promise.allSettled([
      emailQueue.close(),
      legalEntityArchiveQueue.close(),
      uploadValidationQueue.close(),
      imageCleanupQueue.close(),
      qrCodeScanQueue.close(),
      marketingSyncQueue.close(),
      marketingEventsBullQueue.close(),
      payoutStatementQueue.close(),
      dataExportQueue.close(),
      queueAdmin.close(),
    ]);
  };

  const adminMarketingEventsService = new AdminMarketingEventsService(db, env.SENTRY_DSN_API);

  const emailUnsubscribeService = new EmailUnsubscribeService(
    db,
    env,
    userRepo,
    notificationPreferenceRepository,
  );
  const postmarkWebhookService = new PostmarkWebhookService(db, (token) =>
    emailUnsubscribeService.applyToken(token),
  );

  const adminPaymentListQueryService = new AdminPaymentListQueryService(paymentRepo);

  const adminBase = createAdminRouteServices({
    db,
    domainEventPublisher,
    impersonationSessionService,
    impersonationAuditService,
    userSuspensionChecker: cachedUserSuspensionChecker,
    legalEntityRepository,
    legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService,
    categoryService,
    artistProfileService,
    emailObservabilityRepository,
    adminUserService,
    profileService,
    analyticsService,
    adminMetricsService,
    attentionFeedReader,
    conveyorPipelineReader,
    itemSubmissionService,
    paymentService,
    adminPaymentListQueryService,
    lotService,
    adminLotBrowseService,
    saleRegistrationService,
    artistRegistryService,
    resolvePlatformCatalogLegalEntityId,
    invitationService,
    xeroOAuthService,
    xeroConnectionRepository: xeroConnRepo,
    xeroWebhookEventRepository,
    paymentExternalRefRepository: paymentExtRepo,
    displayPairingService,
    displayOverlayService,
    qrCodeService,
    qrCodeAnalytics,
    conditionReportService,
    mediaUrlResolver,
    mediaAssetEnricher,
    amlService,
    adminSourceOfFundsQueryService,
    sourceOfFundsService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
    stripeConnectService,
    env,
  });

  const adminLotsKpiTrendService = new AdminLotsKpiTrendService(lotRepo);
  const adminPaymentsKpiTrendService = new AdminPaymentsKpiTrendService(paymentRepo);
  const adminSalesKpiTrendService = new AdminSalesKpiTrendService(saleRepo);
  const adminPayoutsKpiTrendService = new AdminPayoutsKpiTrendService(payoutRepository);

  const adminNavCountsService = new AdminNavCountsService(
    createAdminNavCountsDeps({
      db,
      admin: adminBase,
      repoFactory,
      conditionReportService,
      lotFulfilmentService,
      saleService,
      invitationService,
      amlService,
      sourceOfFundsService,
      telephoneBidBookingService,
    }),
    cache,
    30,
  );

  const admin = attachAdminDashboardMetrics(adminBase, {
    navCounts: adminNavCountsService,
    lotsKpiTrend: adminLotsKpiTrendService,
    paymentsKpiTrend: adminPaymentsKpiTrendService,
    salesKpiTrend: adminSalesKpiTrendService,
    payoutsKpiTrend: adminPayoutsKpiTrendService,
  });

  return {
    env,
    db,
    authDb,
    sessionRevocation,
    redis,
    rateLimitStore,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    auth,
    getPublicJwks,
    authenticator,
    repoFactory,
    lotService,
    conditionReportService,
    saleService,
    saleListReadService,
    pressArchiveReadService,
    saleSoftDeleteService,
    lotSoftDeleteService,
    saleFollowService,
    saleBiddersService,
    saleRegistrationService,
    lotLifecycleService,
    lotLifecycleQueryService,
    lotTransitionOrchestrator,
    adminLotBrowseService,
    absenteeBidService,
    telephoneBidBookingService,
    paddleService,
    saleroomCheckInService,
    onsiteEventRsvpService,
    onsiteEventCheckInService,
    adminSaleOperationsSnapshotService,
    saleroomService,
    displayPairingService,
    displayOverlayService,
    displaySnapshotReader,
    saleroomOnBlockPolicy,
    lotFulfilmentService,
    saleLifecycleService,
    lotJobScheduler,
    saleStatusTransitionService,
    bidService,
    autoBidService,
    categoryService,
    venueService,
    resolvePlatformCatalogLegalEntityId,
    artistProfileService,
    artistDeleteService,
    dashboardQueryService,
    userDashboardReadService,
    cachedCatalogueListService,
    notificationQueryService,
    paymentService,
    lotInvoiceInitiationService,
    qrCodeService,
    qrCodeAnalytics,
    paymentRefundReconcileService,
    accountingProvider,
    invoiceAddressingService,
    xeroPayoutBillWriter,
    xeroPaymentRecorder,
    xeroOAuthService,
    xeroWebhookEventRepository,
    userService,
    watchlistService,
    savedSearchService,
    artistWatchlistService,
    notificationService,
    notificationPreferenceRepository,
    uiPreferenceRepository,
    uiPreferenceService,
    pushSubscriptionRepository,
    notificationDispatcher,
    notificationOutboxProcessor,
    notificationFactory,
    emailService,
    emailObservabilityRepository,
    userSuspensionChecker: cachedUserSuspensionChecker,
    userSuspensionCacheInvalidator: cachedUserSuspensionChecker,
    registrationService,
    invitationService,
    profileService,
    addressService,
    analyticsService,
    domainEventPublisher,
    authAuditPublisher,
    legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService,
    impersonationAuditService,
    impersonationSessionService,
    legalEntityAccessService,
    requireLegalEntityContext,
    requireSubmissionsLegalEntityContext,
    adminUserService,
    adminNavCountsService,
    adminLotsKpiTrendService,
    adminPaymentsKpiTrendService,
    adminSalesKpiTrendService,
    adminPayoutsKpiTrendService,
    adminPaymentListQueryService,
    adminMetricsService,
    attentionFeedReader,
    httpErrorHandler,
    itemSubmissionRepository,
    itemSubmissionService,
    legalEntityRepository,
    personalLegalEntityResolver,
    legalEntityNotificationRecipients,
    kycRepository,
    kycService,
    kycResubmissionNotifier,
    amlService,
    sourceOfFundsService,
    adminSourceOfFundsQueryService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
    organizationOnboardingService,
    orgModuleGate,
    organizationOnboardingFlowService,
    artistRegistryService,
    stripeConnectService,
    memberManagementService,
    pendingInvitationsReader,
    invitationLifecycleService,
    transactionalMailer,
    payoutRepository,
    payoutService,
    objectStorage,
    mediaUrlResolver,
    mediaAssetEnricher,
    uploadService,
    lotDocumentService,
    saleDocumentService,
    submissionDocumentService,
    uploadValidationQueue,
    imageCleanupQueue,
    marketingSyncQueue,
    payoutStatementQueue,
    dataExportQueue,
    exportService,
    legalEntityArchiveQueue,
    stripePaymentWebhookService: stripePaymentWebhookServiceResolved,
    stripeClientFactory,
    stripeWebhookVerifier,
    marketingEventService,
    marketingEventPublisher,
    clickIdStore,
    postmarkWebhookService,
    adminMarketingEventsService,
    emailUnsubscribeService,
    admin,
    queueAdmin,
    closeBullQueues,
  };
}
