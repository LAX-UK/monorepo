import type { Auth } from "@auction/auth/server";
import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { BetterAuthEmailSignupPersister } from "../infrastructure/better-auth-email-signup.persister.js";
import { CompositeErrorClassifier } from "../infrastructure/composite-error.classifier.js";
import { ConsoleErrorLogger } from "../infrastructure/console-error.logger.js";
import { DrizzleRegistrationCompensator } from "../infrastructure/drizzle-registration.compensator.js";
import { JsonErrorResponseBuilder } from "../infrastructure/json-error-response.builder.js";
import { NoOpWelcomeNotifier } from "../infrastructure/no-op-welcome.notifier.js";
import { DrizzleUserProfilePersister } from "../infrastructure/user-profile.persister.js";
import { ZodRegistrationValidator } from "../infrastructure/zod-registration.validator.js";
import { createBaseLogger } from "../lib/logger.js";
import { type OrgModuleGate, createOrgModuleGate } from "../lib/org-module-gate.js";
import { queueRuntimeEnvFromApiEnv } from "../lib/queue-runtime-env.js";
import { createSubmissionsLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { DrizzleAdminUserSuspender } from "../repositories/drizzle-admin-user.reader.js";
import { AddressService } from "../services/address.service.js";
import { AdminUserService } from "../services/admin-user.service.js";
import { AdminMarketingEventsService } from "../services/admin/admin-marketing-events.service.js";
import { AdminPaymentListQueryService } from "../services/admin/admin-payment-list-query.service.js";
import { StructuredQueueAuditService } from "../services/admin/queue-audit.service.js";
import { BullMQQueueInspector } from "../services/admin/queue-inspector.service.js";
import { BullMQQueueMutator } from "../services/admin/queue-mutator.service.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { ArtistWatchlistService } from "../services/artist-watchlist.service.js";
import { DefaultMetricsAggregator } from "../services/default-metrics.aggregator.js";
import { EmailUnsubscribeService } from "../services/email-unsubscribe.service.js";
import { ErrorHandlerService } from "../services/error-handler.service.js";
import { InvitationConsumptionService } from "../services/invitation-consumption.service.js";
import { InvitationService } from "../services/invitation.service.js";
import type { EnsurePersonalLegalEntityService } from "../services/legal-entity/ensure-personal-legal-entity.service.js";
import { PersonalLegalEntityResolver } from "../services/legal-entity/personal-legal-entity-resolver.service.js";
import { PostmarkWebhookService } from "../services/postmark-webhook.service.js";
import { ProfileService } from "../services/profile.service.js";
import { RegistrationService } from "../services/registration.service.js";
import { SavedSearchService } from "../services/saved-search.service.js";
import type { SessionRevocationService } from "../services/session-revocation.service.js";
import { UserDashboardReadService } from "../services/user-dashboard-read.service.js";
import { UserService } from "../services/user.service.js";
import { WatchlistService } from "../services/watchlist.service.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerUserMiscServices = {
  userService: UserService;
  personalLegalEntityResolver: PersonalLegalEntityResolver;
  requireSubmissionsLegalEntityContext: ReturnType<typeof createSubmissionsLegalEntityContext>;
  watchlistService: WatchlistService;
  userDashboardReadService: UserDashboardReadService;
  savedSearchService: SavedSearchService;
  artistWatchlistService: ArtistWatchlistService;
  profileService: ProfileService;
  addressService: AddressService;
  invitationService: InvitationService;
  registrationService: RegistrationService;
  analyticsService: AnalyticsService;
  orgModuleGate: OrgModuleGate;
  adminUserService: AdminUserService;
  httpErrorHandler: ErrorHandlerService;
  queueAdmin: {
    inspector: BullMQQueueInspector;
    mutator: BullMQQueueMutator;
    close: () => Promise<void>;
  };
  closeBullQueues: () => Promise<void>;
  adminMarketingEventsService: AdminMarketingEventsService;
  emailUnsubscribeService: EmailUnsubscribeService;
  postmarkWebhookService: PostmarkWebhookService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
};

export type CreateUserMiscServicesInput = {
  env: Env;
  db: Database;
  authDb: Database;
  auth: Auth;
  sessionRevocation: SessionRevocationService;
  ensurePersonalLegalEntityService: EnsurePersonalLegalEntityService;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
  catalog: ContainerCatalogServices;
  payments: ContainerPaymentsServices;
};

export function createUserMiscServices(
  input: CreateUserMiscServicesInput,
): ContainerUserMiscServices {
  const {
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
  } = input;
  const {
    redis,
    bullConnection,
    emailService,
    emailQueue,
    legalEntityArchiveQueue,
    uploadValidationQueue,
    imageCleanupQueue,
    qrCodeScanQueue,
    marketingSyncQueue,
    marketingEventsBullQueue,
    payoutStatementQueue,
    dataExportQueue,
  } = infra;
  const {
    userRepo,
    legalEntityRepository,
    watchlistRepo,
    lotRepo,
    artistWatchlistRepo,
    profileRepo,
    addressRepo,
    invitationRepository,
    lotMetrics,
    paymentMetrics,
    userMetrics,
    adminUserReader,
    adminRoleManager,
    adminActivityReader,
    adminUserBidsReader,
    adminUserKycReader,
    notificationPreferenceRepository,
    paymentRepo,
  } = repos;
  const {
    domainEventPublisher,
    impersonationSessionService,
    impersonationAuditService,
    authAuditPublisher,
    cachedUserSuspensionChecker,
  } = platform;
  const { marketingEventService, mediaUrlResolver, mediaAssetEnricher, imageCleanupService } =
    complianceMedia;
  const { dashboardQueryService, saleService, artistProfileService } = catalog;
  const { errorReporter } = payments;

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

  return {
    userService,
    personalLegalEntityResolver,
    requireSubmissionsLegalEntityContext,
    watchlistService,
    userDashboardReadService,
    savedSearchService,
    artistWatchlistService,
    profileService,
    addressService,
    invitationService,
    registrationService,
    analyticsService,
    orgModuleGate,
    adminUserService,
    httpErrorHandler,
    queueAdmin,
    closeBullQueues,
    adminMarketingEventsService,
    emailUnsubscribeService,
    postmarkWebhookService,
    adminPaymentListQueryService,
  };
}
