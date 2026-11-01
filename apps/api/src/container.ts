import { createDb } from "@auction/db";
import {
  DrizzleAdminSavedViewRepository,
  DrizzleBiddingExposureReader,
  DrizzleBuyerAgentAuthorisationRepository,
  DrizzleConsignmentMessageRepository,
  DrizzleLaxAdminRolesRepository,
  DrizzleLaxStaffAccessRepository,
  DrizzleOrganisationBiddingLimitRepository,
  DrizzleRecordPeopleReader,
  DrizzleStaffAccessReviewReader,
  DrizzleStaffNoticeRecipientReader,
  DrizzleStaffRoleAssignmentReader,
  DrizzleStaffRoster,
} from "@auction/persistence/repositories";
import type { Container, ContainerComposedSlices } from "./container/container-slices.js";
import { createAdminServices } from "./container/create-admin-services.js";
import { createContainerAuthenticator } from "./container/create-auth.js";
import { createBiddingRouteServices } from "./container/create-bidding-route-services.js";
import { createBiddingSaleroom } from "./container/create-bidding-saleroom.js";
import { createCatalogRouteServices } from "./container/create-catalog-route-services.js";
import { createCatalogServices } from "./container/create-catalog-services.js";
import { createComplianceMedia } from "./container/create-compliance-media.js";
import { createComplianceRouteServices } from "./container/create-compliance-route-services.js";
import { createCronServices } from "./container/create-cron-services.js";
import { createFinanceRouteServices } from "./container/create-finance-route-services.js";
import { createIdentityRouteServices } from "./container/create-identity-route-services.js";
import { createInfra } from "./container/create-infra.js";
import { createLotLifecycle } from "./container/create-lot-lifecycle.js";
import { createOrganisationAccessServices } from "./container/create-organisation-access-services.js";
import { createOrganisationBuyingServices } from "./container/create-organisation-buying-services.js";
import { createOrganisationHomeServices } from "./container/create-organisation-home-services.js";
import { createOrganisationMembershipServices } from "./container/create-organisation-membership-services.js";
import { createOrganisationSellingServices } from "./container/create-organisation-selling-services.js";
import { createOrganisationTeamServices } from "./container/create-organisation-team-services.js";
import { createOrganisationWorkspaceServices } from "./container/create-organisation-workspace-services.js";
import { createPaymentsServices } from "./container/create-payments-services.js";
import { createPlatformCronRouteServices } from "./container/create-platform-cron-route-services.js";
import { createPlatformServices } from "./container/create-platform-services.js";
import { createRepositories } from "./container/create-repositories.js";
import { createSubmissionRouteServices } from "./container/create-submission-route-services.js";
import { createUserMiscServices } from "./container/create-user-misc-services.js";
import { createUserNotificationComposition } from "./container/create-user-notification-composition.js";
import { createUserRouteServices } from "./container/create-user-route-services.js";
import type { Env } from "./env.js";
import { DrizzleSubjectUsageReader } from "./infrastructure/drizzle-subject-usage.reader.js";
import { HttpIdentityIssuerClient } from "./infrastructure/http-identity-issuer.client.js";
import { IdentityAddressBookRepository } from "./infrastructure/identity-address-book.repository.js";
import { RedisIdempotencyStore } from "./infrastructure/redis-idempotency.store.js";
import { RedisOAuthAttributionStore } from "./infrastructure/redis-oauth-attribution.store.js";
import { StaffAdministratorDirectory } from "./infrastructure/staff-administrators.js";
import { StaffRoleChangeNotifier } from "./infrastructure/staff-role-change.notifier.js";
import { createAppLogger } from "./lib/logger.js";
import { AdminSavedViewService } from "./services/admin/admin-saved-view.service.js";
import { AdminTwoFactorResetService } from "./services/admin/admin-two-factor-reset.service.js";
import { AtgAdminService } from "./services/admin/atg-admin.service.js";
import { StaffAccessAdminService } from "./services/admin/staff-access-admin.service.js";
import { OrganisationBiddingLimitsService } from "./services/bidding-limits/organisation-bidding-limits.service.js";
import {
  BidAuthorityQueryService,
  BuyerAgentAuthorisationService,
} from "./services/buyer-agents/buyer-agent-authorisation.service.js";
import { MyBuyerAgentAuthorisationsService } from "./services/buyer-agents/my-buyer-agent-authorisations.service.js";
import { EnsurePersonalLegalEntityService } from "./services/legal-entity/ensure-personal-legal-entity.service.js";
import { NotificationAccountMuteService } from "./services/notifications/notification-account-mute.service.js";
import { TwoFactorPolicyService } from "./services/security/two-factor-policy.service.js";
import { SessionRevocationService } from "./services/session-revocation.service.js";
import { StaffStepUpService } from "./services/staff-step-up.service.js";
import { LaxAdminRolesService } from "./services/staff/lax-admin-roles.service.js";
import { StaffRoleAssignmentService } from "./services/staff/staff-role-assignment.service.js";
import { StaffRolesAdminService } from "./services/staff/staff-roles-admin.service.js";
import { SubmissionAccessGuard } from "./services/submission/submission-access-guard.js";

export type { Container, ContainerComposedSlices };

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL_API ?? env.DATABASE_URL);
  const infra = createInfra(env, db);
  const oauthAttributionStore = new RedisOAuthAttributionStore(infra.redis);
  const identityIssuer = new HttpIdentityIssuerClient({
    issuerBaseUrl: env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL,
    defaultOrigin: env.WEB_ORIGIN,
    ...(env.IDENTITY_MACHINE_CLIENT_ID ? { machineClientId: env.IDENTITY_MACHINE_CLIENT_ID } : {}),
    ...(env.IDENTITY_MACHINE_CLIENT_SECRET
      ? { machineClientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET }
      : {}),
  });
  const sessionRevocation = new SessionRevocationService(identityIssuer);
  const subjectUsageReader = new DrizzleSubjectUsageReader(db);
  const ensurePersonalLegalEntityService = new EnsurePersonalLegalEntityService(db);
  const authenticator = createContainerAuthenticator({ env, db });

  const repos = createRepositories(db, identityIssuer);
  if (env.ADDRESS_BOOK_SOURCE === "identity") {
    repos.addressRepo = new IdentityAddressBookRepository(
      identityIssuer,
      repos.addressRepo,
      async (userId) => (await identityIssuer.readSubject(userId))?.name ?? null,
      createAppLogger(env),
    );
  }

  const userNotification = createUserNotificationComposition(repos);

  const platform = createPlatformServices({
    env,
    db,
    infra,
    repos,
    identitySubjects: identityIssuer,
  });
  const lotLifecycle = createLotLifecycle({ infra, repos, platform });
  const complianceMedia = createComplianceMedia({ env, db, infra, repos, platform });
  const catalog = createCatalogServices({
    env,
    db,
    identitySecurity: identityIssuer,
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
    adminMetricsService: payments.adminMetricsService,
  });
  const userMisc = createUserMiscServices({
    env,
    db,
    identityIssuer,
    ensurePersonalLegalEntityService,
    infra,
    repos,
    platform,
    complianceMedia,
    catalog,
    payments,
  });
  const cron = createCronServices({
    env,
    db,
    infra,
    repos,
    platform,
    payments,
    catalog,
    lotLifecycle,
    biddingSaleroom,
    complianceMedia,
  });
  const compliance = createComplianceRouteServices({
    db,
    transactionRunner: platform.transactionRunner,
    legalEntityRepository: repos.legalEntityRepository,
    domainEventSink: platform.domainEventSink,
    kycService: complianceMedia.kycService,
    amlService: complianceMedia.amlService,
    stripeConnectService: platform.stripeConnectService,
    marketingEventService: complianceMedia.marketingEventService,
    kycResubmissionNotifier: complianceMedia.kycResubmissionNotifier,
    sourceOfFundsDocumentCollectionService: complianceMedia.sourceOfFundsDocumentCollectionService,
    uploadService: complianceMedia.uploadService,
    exportService: complianceMedia.exportService,
    lotDocumentService: complianceMedia.lotDocumentService,
    saleDocumentService: complianceMedia.saleDocumentService,
    storageDriver: env.STORAGE_DRIVER,
  });
  const finance = createFinanceRouteServices({
    redis: infra.redis,
    legalEntityRepository: repos.legalEntityRepository,
    payoutRepository: repos.payoutRepository,
    payoutStatementQueue: infra.payoutStatementQueue,
    paymentAdminService: payments.paymentAdminService,
    paymentBuyerService: payments.paymentBuyerService,
    buyerComplianceHttp: compliance.buyerComplianceHttp,
    lotFulfilmentBuyerService: payments.lotFulfilmentService,
    marketingEventService: complianceMedia.marketingEventService,
    attributionStore: complianceMedia.attributionStore,
    marketingAttributionEnabled: complianceMedia.marketingAttributionEnabled,
    sourceOfFundsDocumentCollectionService: complianceMedia.sourceOfFundsDocumentCollectionService,
    settlementCronService: cron.settlementCronService,
    paymentMaintenanceCronService: cron.paymentMaintenanceCronService,
    accountingReplayCronService: cron.accountingReplayCronService,
    stripeWebhookVerifier: infra.stripeWebhookVerifier,
    stripeConnectService: platform.stripeConnectService,
    stripePaymentWebhookService: payments.stripePaymentWebhookService,
    payoutSellerService: platform.payoutSellerService,
    env,
    xeroWebhookEventRepository: repos.xeroWebhookEventRepository,
    accountingProvider: payments.accountingProvider,
    webhookEventRepository: repos.webhookEventRepository,
    webhookEventsProducer: infra.webhookEventsProducer,
  });
  const laxAdminRoles = new DrizzleLaxAdminRolesRepository(db);
  const staffNoticeRecipients = new DrizzleStaffNoticeRecipientReader(db);
  const staffAdministrators = new StaffAdministratorDirectory(staffNoticeRecipients, laxAdminRoles);
  const platformCron = createPlatformCronRouteServices({
    redis: infra.redis,
    lifecycleCronService: cron.lifecycleCronService,
    hygieneCronService: cron.hygieneCronService,
    staffRoster: repos.staffRoster,
    laxAdminRoleExpiry: laxAdminRoles,
    staffNoticeRecipients,
    staffAdministrators,
    notificationDispatcher: platform.notificationDispatcher,
    emailService: infra.emailService,
    webOrigin: env.WEB_ORIGIN,
  });
  const catalogRoutes = createCatalogRouteServices({
    saleService: catalog.saleService,
    saleSoftDeleteService: catalog.saleSoftDeleteService,
    saleStatusTransitionService: catalog.saleStatusTransitionService,
    lotService: catalog.lotService,
    lotSoftDeleteService: catalog.lotSoftDeleteService,
    mediaUrlResolver: complianceMedia.mediaUrlResolver,
    mediaAssetEnricher: complianceMedia.mediaAssetEnricher,
    db,
    objectStorage: infra.objectStorage,
    cachedCatalogueListService: platform.cachedCatalogueListService,
    lotLifecycleQueryService: catalog.lotLifecycleQueryService,
    stripeConnectService: platform.stripeConnectService,
    legalEntityRepository: repos.legalEntityRepository,
    saleListReadService: catalog.saleListReadService,
    repoFactory: repos.repoFactory,
    saleroomService: biddingSaleroom.saleroomService,
    saleBiddersService: catalog.saleBiddersService,
    categoryService: catalog.categoryService,
    pressArchiveReadService: catalog.pressArchiveReadService,
    saleFollowService: catalog.saleFollowService,
    artistRegistryService: platform.artistRegistryService,
    artistProfileService: catalog.artistProfileService,
    artistDeleteService: catalog.artistDeleteService,
    venueService: catalog.venueService,
  });
  const submissionRoutes = createSubmissionRouteServices({
    itemSubmissionSellerApi: catalog.itemSubmissionSellerApi,
    itemSubmissionAdminApi: catalog.itemSubmissionAdminApi,
    submissionDocumentService: complianceMedia.submissionDocumentService,
    consignmentAgreementService: catalog.consignmentAgreementService,
    submissionAccess: new SubmissionAccessGuard(repos.itemSubmissionRepository),
    consignmentAfterSaleHttp: catalog.consignmentAfterSaleHttp,
    recordPeople: new DrizzleRecordPeopleReader(db),
    consignmentMessages: {
      repository: new DrizzleConsignmentMessageRepository(db),
      dispatcher: platform.notificationDispatcher,
      recipients: repos.legalEntityNotificationRecipients,
      storage: infra.objectStorage,
      media: complianceMedia.mediaUrlResolver,
    },
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
    payoutStatementApplication: finance.payoutStatement,
  });

  const twoFactorPolicy = new TwoFactorPolicyService({
    identity: identityIssuer,
    members: repos.legalEntityMemberRepository,
    audit: platform.authAuditPublisher,
  });
  const twoFactorReset = new AdminTwoFactorResetService({
    identity: identityIssuer,
    users: repos.adminUserReader,
    audit: platform.authAuditPublisher,
  });
  const staffAccess = new StaffAccessAdminService({
    access: new DrizzleLaxStaffAccessRepository(db),
    users: repos.adminUserReader,
    identity: identityIssuer,
  });

  const staffRoles = new StaffRolesAdminService({
    changes: new StaffRoleAssignmentService(new DrizzleStaffRoster(db)),
    roles: new DrizzleStaffRoleAssignmentReader(db),
    users: repos.adminUserReader,
    review: new DrizzleStaffAccessReviewReader(db),
    laxAdminRoles,
    identity: identityIssuer,
  });
  const laxAdminRoleChanges = new LaxAdminRolesService({
    roles: laxAdminRoles,
    requests: laxAdminRoles,
    users: repos.adminUserReader,
    notifier: new StaffRoleChangeNotifier(
      staffNoticeRecipients,
      staffAdministrators,
      platform.notificationDispatcher,
      infra.emailService,
      env.WEB_ORIGIN,
    ),
  });

  const savedViews = new AdminSavedViewService(new DrizzleAdminSavedViewRepository(db));
  const buyerAgentAuthorisationRepository = new DrizzleBuyerAgentAuthorisationRepository(db);

  const buyerAgentAuthorisations = new BuyerAgentAuthorisationService({
    directory: buyerAgentAuthorisationRepository,
    writer: buyerAgentAuthorisationRepository,
    members: repos.legalEntityMemberRepository,
    sales: repos.saleRepo,
    events: platform.domainEventSink,
  });
  const buyerAgents = {
    authorisations: buyerAgentAuthorisations,
    bidAuthority: new BidAuthorityQueryService(catalog.bidAuthority),
    limits: new OrganisationBiddingLimitsService({
      limits: new DrizzleOrganisationBiddingLimitRepository(db),
      exposure: new DrizzleBiddingExposureReader(db),
      authorisations: buyerAgentAuthorisationRepository,
      events: platform.domainEventSink,
    }),
    mine: new MyBuyerAgentAuthorisationsService({
      directory: buyerAgentAuthorisationRepository,
      sales: repos.saleRepo,
      registrations: repos.saleRegistrationRepository,
    }),
  };
  const organisationMembership = createOrganisationMembershipServices({ db });
  const organisationHome = createOrganisationHomeServices({ db });
  const organisationBuying = createOrganisationBuyingServices({
    db,
    env,
    lots: repos.lotRepo,
    sales: repos.saleRepo,
    notificationDispatcher: platform.notificationDispatcher,
    notificationFactory: platform.notificationFactory,
    payments: {
      tierLimits: payments.paymentTierPolicy.limitsSnapshot,
      compliance: payments.settlementCompliancePolicy,
      groupCheckout: payments.paymentGroupCheckout,
    },
  });
  const organisationAccess = createOrganisationAccessServices({
    db,
    memberManagement: platform.memberManagementService,
    recipients: repos.legalEntityNotificationRecipients,
    notificationDispatcher: platform.notificationDispatcher,
    notificationFactory: platform.notificationFactory,
    events: platform.domainEventSink,
  });
  const organisationSelling = createOrganisationSellingServices({
    db,
    submissionAccess: new SubmissionAccessGuard(repos.itemSubmissionRepository),
  });
  const organisationWorkspace = createOrganisationWorkspaceServices({
    db,
    legalEntities: repos.legalEntityRepository,
    connectEnforced: () => platform.stripeConnectService.isConfigured(),
    buyerAgentAuthorisations: buyerAgents.mine,
  });
  const organisationTeam = createOrganisationTeamServices({
    db,
    events: platform.domainEventSink,
  });

  const atg = new AtgAdminService(
    repos.atgLinkReader,
    repos.atgSaleSettingsWriter,
    infra.atgSyncQueue,
    env.ATG_WHITE_LABEL_BASE_URL ?? null,
    createAppLogger(env),
  );

  return {
    env,
    db,
    sessionRevocation,
    redis: infra.redis,
    rateLimitStore: infra.rateLimitStore,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    authenticator,
    identityIssuer,
    subjectUsageReader,
    oauthAttributionStore,
    authOAuthAccountReader: identityIssuer,
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
    onsiteEventPublicRsvpService: catalog.onsiteEventPublicRsvpService,
    onsiteEventAdminService: catalog.onsiteEventAdminService,
    onsiteEventPassService: catalog.onsiteEventPassService,
    onsiteEventStaffCheckInService: catalog.onsiteEventStaffCheckInService,
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
    notificationQueryService: userNotification.notificationQueryService,
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
    newsletterSignupService: userMisc.newsletterSignupService,
    webhookEventRepository: repos.webhookEventRepository,
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
    accountOnboardingService: userMisc.accountOnboardingService,
    accountOnboardingGate: userMisc.accountOnboardingGate,
    invitationService: userMisc.invitationService,
    invitationRepository: userMisc.invitationRepository,
    profileService: userMisc.profileService,
    addressService: userMisc.addressService,
    staffInvitationAccept: userMisc.staffInvitationAccept,
    domainEventSink: platform.domainEventSink,
    transactionRunner: platform.transactionRunner,
    authAuditPublisher: platform.authAuditPublisher,
    legalEntityLifecycleAdminService: platform.legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService: complianceMedia.legalEntityDocumentAdminService,
    impersonationAuditService: platform.impersonationAuditService,
    impersonationSessionService: platform.impersonationSessionService,
    legalEntityAccessService: platform.legalEntityAccessService,
    requireLegalEntityContext: platform.requireLegalEntityContext,
    requireSubmissionsLegalEntityContext: userMisc.requireSubmissionsLegalEntityContext,
    adminUserService: userMisc.adminUserService,
    adminPaymentListQueryService: userMisc.adminPaymentListQueryService,
    adminMetricsService: payments.adminMetricsService,
    attentionFeedReader: repos.attentionFeedReader,
    httpErrorHandler: userMisc.httpErrorHandler,
    itemSubmissionRepository: repos.itemSubmissionRepository,
    itemSubmissionService: catalog.itemSubmissionService,
    itemSubmissionSellerApi: catalog.itemSubmissionSellerApi,
    itemSubmissionAdminApi: catalog.itemSubmissionAdminApi,
    consignmentAgreementService: catalog.consignmentAgreementService,
    consignmentAfterSaleHttp: catalog.consignmentAfterSaleHttp,
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
    payoutSellerService: platform.payoutSellerService,
    payoutAdminService: platform.payoutAdminService,
    payoutSettlementService: platform.payoutSettlementService,
    payoutMaintenanceService: platform.payoutMaintenanceService,
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
    stripeClientFactory: infra.stripeClientFactory,
    stripeWebhookVerifier: infra.stripeWebhookVerifier,
    marketingEventService: complianceMedia.marketingEventService,
    marketingEventPublisher: complianceMedia.marketingEventPublisher,
    clickIdStore: complianceMedia.clickIdStore,
    attributionStore: complianceMedia.attributionStore,
    marketingAttributionEnabled: complianceMedia.marketingAttributionEnabled,
    postmarkWebhookService: userMisc.postmarkWebhookService,
    brevoWebhookIngestService: cron.brevoWebhookIngestService,
    accountDeletionEligibilityService: cron.accountDeletionEligibilityService,
    adminMarketingEventsService: userMisc.adminMarketingEventsService,
    emailUnsubscribeService: userMisc.emailUnsubscribeService,
    bidding: createBiddingRouteServices({
      bidPlacer: biddingSaleroom.bidService,
      absenteeBidService: biddingSaleroom.absenteeBidService,
      autoBidService: biddingSaleroom.autoBidService,
      conditionReportService: catalog.conditionReportService,
      saleRegistrationBuyer: biddingSaleroom.saleRegistrationService,
      telephoneBidBookingBuyer: catalog.telephoneBidBookingService,
      lotService: catalog.lotService,
      displayPairingService: biddingSaleroom.displayPairingService,
      displaySnapshotReader: biddingSaleroom.displaySnapshotReader,
    }),
    identityRoutes: createIdentityRouteServices({
      accountSecurity: {
        env,
        identityIssuer,
        emailService: infra.emailService,
        authAuditPublisher: platform.authAuditPublisher,
        authCredentialReader: identityIssuer,
      },
      legalEntityRepository: repos.legalEntityRepository,
      personalLegalEntityResolver: userMisc.personalLegalEntityResolver,
      orgModuleGate: userMisc.orgModuleGate,
      userService: userMisc.userService,
      pendingInvitationsReader: repos.pendingInvitationsReader,
      invitationLifecycleService: platform.invitationLifecycleService,
      legalEntityAccessService: platform.legalEntityAccessService,
      memberManagementService: platform.memberManagementService,
      organisationInvitationService: platform.organisationInvitationService,
      organizationOnboardingService: platform.organizationOnboardingService,
      organizationOnboardingFlowService: platform.organizationOnboardingFlowService,
      orgTwoFactorPolicy: twoFactorPolicy,
      rememberedAccountStore: repos.rememberedAccountStore,
      recordAccountReader: repos.recordAccountReader,
    }),
    userRoutes: createUserRouteServices({
      env,
      bidPortfolioReader: repos.bidPortfolioReader,
      recordPeople: new DrizzleRecordPeopleReader(db),
      categoryInterestsEligibilityReader: repos.categoryInterestsEligibilityReader,
      categoryInterestsRepository: repos.categoryInterestsRepository,
      accountOnboardingService: userMisc.accountOnboardingService,
      accountOnboardingGate: userMisc.accountOnboardingGate,
      marketingEventService: complianceMedia.marketingEventService,
      attributionStore: complianceMedia.attributionStore,
      marketingAttributionEnabled: complianceMedia.marketingAttributionEnabled,
      userService: userMisc.userService,
      mediaUrlResolver: complianceMedia.mediaUrlResolver,
      conditionReportService: catalog.conditionReportService,
      userDashboardReadService: userMisc.userDashboardReadService,
      lotService: catalog.lotService,
      paymentBuyerService: payments.paymentBuyerService,
      mediaAssetEnricher: complianceMedia.mediaAssetEnricher,
      saleService: catalog.saleService,
      watchlistService: userMisc.watchlistService,
      artistWatchlistService: userMisc.artistWatchlistService,
      savedSearchService: userMisc.savedSearchService,
      notificationQueryService: userNotification.notificationQueryService,
      notificationAccountMuteService: new NotificationAccountMuteService(
        repos.notificationAccountMuteRepository,
      ),
      vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
      pushSubscriptionRepository: repos.pushSubscriptionRepository,
      notificationPreferenceRepository: repos.notificationPreferenceRepository,
      uiPreferenceService: platform.uiPreferenceService,
      profileService: userMisc.profileService,
      addressService: userMisc.addressService,
      sessionRevocation,
      authAuditPublisher: platform.authAuditPublisher,
      twoFactorRequirement: twoFactorPolicy,
      requireBuyingAccount: userMisc.requireSubmissionsLegalEntityContext,
      staffInvitationAccept: userMisc.staffInvitationAccept,
    }),
    admin: {
      ...admin.admin,
      staffTwoFactorPolicy: twoFactorPolicy,
      twoFactorReset,
      staffAccess,
      staffRoles,
      laxAdminRoles: laxAdminRoleChanges,
      savedViews,
      atg,
      buyerAgentAuthorisations,
      deliveryQuotes: organisationBuying.staffDeliveryQuotes,
      stepUp: new StaffStepUpService(identityIssuer),
      idempotencyStore: new RedisIdempotencyStore(infra.redis),
    },
    finance,
    platformCron,
    compliance,
    catalogRoutes,
    submissionRoutes,
    buyerAgents,
    organisationMembership,
    organisationHome,
    organisationBuying: organisationBuying.client,
    organisationSelling,
    organisationAccess,
    organisationWorkspace,
    organisationTeam,
    queueAdmin: userMisc.queueAdmin,
    closeBullQueues: userMisc.closeBullQueues,
  };
}

export type {
  ContainerAdminMarketingEventsRoutesSlice,
  ContainerAdminMyStaffToolsRoutesSlice,
  ContainerAdminOnsiteEventRoutesSlice,
  ContainerAdminPayoutRoutesSlice,
  ContainerAdminPlatformRoutesSlice,
  ContainerAdminQueuesRoutesSlice,
  ContainerAdminRoutesSlice,
  ContainerAdminSlice,
  ContainerArtistRoutesSlice,
  ContainerAuthRoutesSlice,
  ContainerBidRoutesSlice,
  ContainerBiddingRoutesSlice,
  ContainerIdentityRoutesSlice,
  ContainerBiddingSaleroomSlice,
  ContainerBrevoWebhookRoutesSlice,
  ContainerCatalogAdminReadersSlice,
  ContainerCatalogSlice,
  ContainerCategoryRoutesSlice,
  ContainerComplianceMediaSlice,
  ContainerCredentialSetupSlice,
  ContainerCronSlice,
  ContainerEmailRoutesSlice,
  ContainerExportRoutesSlice,
  ContainerExposedRepositoriesSlice,
  ContainerForgotPasswordSlice,
  ContainerInfraSlice,
  ContainerInboundWebhookRoutesSlice,
  ContainerInternalCronRoutesSlice,
  ContainerInternalIdentityEmailRoutesSlice,
  ContainerInternalIdentityDeletionEligibilityRoutesSlice,
  ContainerInternalIdentitySubjectUsageRoutesSlice,
  ContainerKycRoutesSlice,
  ContainerLegalEntityBuyerAgentRoutesSlice,
  ContainerLegalEntityMemberRoutesSlice,
  ContainerOrganisationMembershipRoutesSlice,
  ContainerOrganisationHomeRoutesSlice,
  ContainerOrganisationBuyingRoutesSlice,
  ContainerOrganisationSellingRoutesSlice,
  ContainerOrganisationAccessRoutesSlice,
  ContainerOrganisationWorkspaceRoutesSlice,
  ContainerOrganisationTeamRoutesSlice,
  ContainerLegalEntityRoutesSlice,
  ContainerLotCatalogSlice,
  ContainerLotDocumentRoutesSlice,
  ContainerLotLifecycleSlice,
  ContainerLotReadRoutesSlice,
  ContainerLotRouteDepsSlice,
  ContainerLotRoutesSlice,
  ContainerLotSaleSlice,
  ContainerMarketingRoutesSlice,
  ContainerNewsletterRoutesSlice,
  ContainerOnsiteEventRoutesSlice,
  ContainerOnsiteEventSlice,
  ContainerOrganizationOnboardingRoutesSlice,
  ContainerOrganizationRoutesSlice,
  ContainerPasswordStepUpSlice,
  ContainerPaymentHttpRoutesSlice,
  ContainerPaymentsSlice,
  ContainerPayoutRoutesSlice,
  ContainerPayoutStatementRoutesSlice,
  ContainerPlatformSlice,
  ContainerPostmarkWebhookRoutesSlice,
  ContainerPressRoutesSlice,
  ContainerQrRoutesSlice,
  ContainerRepositoriesSlice,
  ContainerRootSlice,
  ContainerSaleDocumentRoutesSlice,
  ContainerSaleRegistrationSlice,
  ContainerSaleroomDisplayRoutesSlice,
  ContainerStripeConnectRoutesSlice,
  ContainerStripeWebhookRoutesSlice,
  ContainerSubmissionDocumentRoutesSlice,
  ContainerSubmissionRoutesSlice,
  ContainerTelephoneBookingRoutesSlice,
  ContainerBuyerTelephoneBookingRoutesSlice,
  ContainerAdminTelephoneBookingRoutesSlice,
  ContainerUploadRoutesSlice,
  ContainerUserMiscSlice,
  ContainerUserProfileSlice,
  ContainerUserAccountRoutesSlice,
  ContainerUserRouteServicesSlice,
  ContainerUserSuspensionExposureSlice,
  ContainerUserUtilitySlice,
  ContainerVenueRoutesSlice,
  ContainerVeriffWebhookRoutesSlice,
  ContainerXeroWebhookRoutesSlice,
  ContainerSaleAuxRoutesSlice,
  ContainerSaleFollowRoutesSlice,
  ContainerSaleLifecycleWriteRoutesSlice,
  ContainerSaleLotMembershipRoutesSlice,
  ContainerSaleReadRoutesSlice,
  ContainerSaleRoutesSlice,
  LotLifecyclePort,
  LotReadPort,
  SaleLifecycleWritePort,
  SaleLookupPort,
  SaleLotMembershipPort,
  SaleReadPort,
  SaleroomReadPort,
  TelephoneBookingRoutePort,
  TelephoneBidBookingServicePort,
} from "./container/container-slices.js";
