import { join } from "node:path";
import { createJwksAdapter } from "@auction/auth";
import { createAuth } from "@auction/auth/server";
import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import { ConsoleEmailService, type IEmailService, PostmarkEmailService } from "@auction/email";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { Env } from "./env.js";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { BetterAuthEmailSignupPersister } from "./infrastructure/better-auth-email-signup.persister.js";
import { CompositeAuthenticator } from "./infrastructure/composite-authenticator.js";
import { ConsoleErrorLogger } from "./infrastructure/console-error.logger.js";
import { DefaultErrorClassifier } from "./infrastructure/default-error.classifier.js";
import { EmailNotificationChannel } from "./infrastructure/email-notification.channel.js";
import { InAppNotificationChannel } from "./infrastructure/in-app-notification.channel.js";
import { JsonErrorResponseBuilder } from "./infrastructure/json-error-response.builder.js";
import { JwtAuthenticator } from "./infrastructure/jwt-authenticator.js";
import { LocalDiskObjectStorage } from "./infrastructure/local-disk-object-storage.js";
import { NoOpErrorReporter } from "./infrastructure/no-op-error.reporter.js";
import { NoOpPushSender } from "./infrastructure/no-op-push.sender.js";
import { NoOpWelcomeNotifier } from "./infrastructure/no-op-welcome.notifier.js";
import { PushNotificationChannel } from "./infrastructure/push-notification.channel.js";
import { RedisCacheProvider } from "./infrastructure/redis-cache.provider.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import { RedisUserNotificationPublisher } from "./infrastructure/redis-user-notification.publisher.js";
import { S3ObjectStorage } from "./infrastructure/s3-object-storage.js";
import { SentryErrorReporter } from "./infrastructure/sentry-error.reporter.js";
import { DrizzleUserProfilePersister } from "./infrastructure/user-profile.persister.js";
import { WebPushSender } from "./infrastructure/web-push.sender.js";
import { WhatsappNotificationChannel } from "./infrastructure/whatsapp-notification.channel.js";
import { ZodRegistrationValidator } from "./infrastructure/zod-registration.validator.js";
import { LotJobScheduler } from "./jobs/lot-job-scheduler.js";
import { createBaseLogger } from "./lib/logger.js";
import { connectionOptionsFromRedisUrl } from "./lib/redis-url.js";
import {
  createRequireLegalEntityContext,
  createSubmissionsLegalEntityContext,
} from "./middleware/require-legal-entity-context.js";
import { DrizzleAddressRepository } from "./repositories/drizzle-address.repository.js";
import {
  DrizzleAdminUserActivityReader,
  DrizzleAdminUserReader,
  DrizzleAdminUserRoleManager,
  DrizzleAdminUserSuspender,
} from "./repositories/drizzle-admin-user.reader.js";
import { DrizzleAntiShillingRepository } from "./repositories/drizzle-anti-shilling.repository.js";
import { DrizzleArtistProfileRepository } from "./repositories/drizzle-artist-profile.repository.js";
import { DrizzleArtistWatchlistRepository } from "./repositories/drizzle-artist-watchlist.repository.js";
import { DrizzleCategoryRepository } from "./repositories/drizzle-category.repository.js";
import { DrizzleEmailObservabilityRepository } from "./repositories/drizzle-email-observability.repository.js";
import { DrizzleUserInvitationRepository } from "./repositories/drizzle-invitation.repository.js";
import { DrizzleItemSubmissionRepository } from "./repositories/drizzle-item-submission.repository.js";
import { DrizzleKycRepository } from "./repositories/drizzle-kyc.repository.js";
import { DrizzleLegalEntityNotificationRecipientRepository } from "./repositories/drizzle-legal-entity-notification-recipient.repository.js";
import { DrizzleLegalEntityRepository } from "./repositories/drizzle-legal-entity.repository.js";
import { DrizzleLotMetricsReader } from "./repositories/drizzle-lot-metrics.reader.js";
import { DrizzleNotificationPreferenceRepository } from "./repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "./repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "./repositories/drizzle-notification-write.repository.js";
import { DrizzlePaymentExternalRefRepository } from "./repositories/drizzle-payment-external-ref.repository.js";
import { DrizzlePaymentMetricsReader } from "./repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRepository } from "./repositories/drizzle-payment.repository.js";
import { DrizzlePayoutRepository } from "./repositories/drizzle-payout.repository.js";
import { DrizzleProfileRepository } from "./repositories/drizzle-profile.repository.js";
import { DrizzlePushSubscriptionRepository } from "./repositories/drizzle-push-subscription.repository.js";
import { DrizzleRepositoryFactory } from "./repositories/drizzle-repository.factory.js";
import { DrizzleSaleBiddersReader } from "./repositories/drizzle-sale-bidders.reader.js";
import { DrizzleSaleFollowRepository } from "./repositories/drizzle-sale-follow.repository.js";
import { DrizzleSaleModeLookup } from "./repositories/drizzle-sale-mode.lookup.js";
import { DrizzleSaleRepository } from "./repositories/drizzle-sale.repository.js";
import { DrizzleUserMetricsReader } from "./repositories/drizzle-user-metrics.reader.js";
import { DrizzleUserSuspensionChecker } from "./repositories/drizzle-user-suspension.checker.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user.repository.js";
import { DrizzleWatchlistRepository } from "./repositories/drizzle-watchlist.repository.js";
import { DrizzleXeroConnectionRepository } from "./repositories/drizzle-xero-connection.repository.js";
import { DrizzleXeroWebhookEventRepository } from "./repositories/drizzle-xero-webhook-event.repository.js";
import { AccountLinkingService } from "./services/account-linking.service.js";
import { NoOpAccountingProvider } from "./services/accounting/no-op-accounting.provider.js";
import { XeroAccountingProvider } from "./services/accounting/xero-accounting.provider.js";
import { XeroPayoutBillWriter } from "./services/accounting/xero-payout-bill.writer.js";
import { AddressService } from "./services/address.service.js";
import { AdminMetricsService } from "./services/admin-metrics.service.js";
import { AdminUserService } from "./services/admin-user.service.js";
import { AnalyticsService } from "./services/analytics.service.js";
import { ArtistProfileService } from "./services/artist-profile.service.js";
import { ArtistRegistryService } from "./services/artist-registry.service.js";
import { ArtistWatchlistService } from "./services/artist-watchlist.service.js";
import { DrizzleAttentionFeedReader } from "./services/attention-feed.service.js";
import { BidService } from "./services/bid.service.js";
import { CategoryService } from "./services/category.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import { DefaultMetricsAggregator } from "./services/default-metrics.aggregator.js";
import { DomainEventPublisher } from "./services/domain-event.publisher.js";
import { ErrorHandlerService } from "./services/error-handler.service.js";
import { ImageCleanupService } from "./services/image-cleanup.service.js";
import { ImpersonationAuditService } from "./services/impersonation-audit.service.js";
import { ImpersonationSessionService } from "./services/impersonation-session.service.js";
import type { IAntiShillingGuard } from "./services/interfaces/anti-shilling.js";
import type { IArtistRegistryService } from "./services/interfaces/artist-registry.js";
import type { IAttentionFeedReader } from "./services/interfaces/attention-feed.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IEmailObservabilityRepository } from "./services/interfaces/email-observability.js";
import type { IItemSubmissionService } from "./services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "./services/interfaces/job-scheduler.js";
import type { IKycRepository } from "./services/interfaces/kyc-repository.js";
import type { IKycService } from "./services/interfaces/kyc-service.js";
import type { ILegalEntityNotificationRecipientReader } from "./services/interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./services/interfaces/legal-entity-repository.js";
import type { IMemberManagementService } from "./services/interfaces/member-management.js";
import type { INotificationPreferenceRepository } from "./services/interfaces/notification-preference.js";
import type { IObjectStorage } from "./services/interfaces/object-storage.js";
import type { IOrganizationOnboardingService } from "./services/interfaces/organization-onboarding.js";
import type { IPaymentAccountingProvider } from "./services/interfaces/payment-accounting-provider.js";
import type { IPayoutRepository } from "./services/interfaces/payout-repository.js";
import type { IPayoutService } from "./services/interfaces/payout.js";
import type { IPushSubscriptionRepository } from "./services/interfaces/push.js";
import type { IPushSender } from "./services/interfaces/push.js";
import type { IItemSubmissionRepository } from "./services/interfaces/repositories.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import type { IStripeConnectService } from "./services/interfaces/stripe-connect.js";
import type { IUserSuspensionChecker } from "./services/interfaces/user-suspension.js";
import type { IXeroWebhookEventRepository } from "./services/interfaces/xero-repositories.js";
import { InvitationService } from "./services/invitation.service.js";
import { InvoiceAddressingService } from "./services/invoice-addressing.js";
import { ItemSubmissionService } from "./services/item-submission.service.js";
import { StripeKycService } from "./services/kyc/stripe-kyc.service.js";
import { LegalEntityLifecycleAdminService } from "./services/legal-entity-lifecycle-admin.service.js";
import { EnsurePersonalLegalEntityService } from "./services/legal-entity/ensure-personal-legal-entity.service.js";
import { LotLifecycleService } from "./services/lot-lifecycle.service.js";
import { LotNotificationCoordinator } from "./services/lot-notification-coordinator.js";
import { LotService } from "./services/lot.service.js";
import { MediaUrlResolver } from "./services/media-url-resolver.js";
import { MemberManagementService } from "./services/member-management.service.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { NotificationDispatcher } from "./services/notification.dispatcher.js";
import { NotificationFactory } from "./services/notification.factory.js";
import { NotificationService } from "./services/notification.service.js";
import { OrganizationOnboardingService } from "./services/organization-onboarding.service.js";
import { OrganizationOnboardingFlowService } from "./services/organization-onboarding/organization-onboarding-flow.service.js";
import { PaymentService } from "./services/payment.service.js";
import { PayoutService } from "./services/payout.service.js";
import { ProfileService } from "./services/profile.service.js";
import { QuietHoursChecker } from "./services/quiet-hours.checker.js";
import { RegistrationService } from "./services/registration.service.js";
import { SaleBiddersService } from "./services/sale-bidders.service.js";
import { SaleFollowService } from "./services/sale-follow.service.js";
import { SaleLifecycleService } from "./services/sale-lifecycle.service.js";
import { SaleStatusTransitionService } from "./services/sale-status-transition.service.js";
import { SaleService } from "./services/sale.service.js";
import { StripePaymentWebhookService } from "./services/stripe-payment-webhook.service.js";
import { StripeConnectService } from "./services/stripe/stripe-connect.service.js";
import { StripePaymentGateway } from "./services/stripe/stripe-payment-gateway.js";
import { UploadService } from "./services/upload.service.js";
import { UserService } from "./services/user.service.js";
import { WatchlistService } from "./services/watchlist.service.js";
import { XeroOAuthService } from "./services/xero-oauth.service.js";
import { LotStrategyFactory } from "./strategies/strategy.factory.js";

export type Container = {
  env: Env;
  db: ReturnType<typeof createDb>;
  redis: Redis;
  /** Exposed for web push subscription (public key only). */
  vapidPublicKey: string | null;
  auth: Auth;
  getPublicJwks: () => Promise<{ keys: unknown[] }>;
  authenticator: IAuthenticator;
  repoFactory: IRepositoryFactory;
  lotService: LotService;
  saleService: SaleService;
  saleFollowService: SaleFollowService;
  saleBiddersService: SaleBiddersService;
  lotLifecycleService: LotLifecycleService;
  saleLifecycleService: SaleLifecycleService;
  lotJobScheduler: ILotJobScheduler;
  saleStatusTransitionService: SaleStatusTransitionService;
  bidService: BidService;
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
  accountingProvider: IPaymentAccountingProvider;
  /** bill-to resolver for Xero + payment-invoice email. */
  invoiceAddressingService: InvoiceAddressingService;
  /** Xero ACCPAY bill creation for paid payouts (null when Xero OAuth env not set). */
  xeroPayoutBillWriter: XeroPayoutBillWriter | null;
  xeroOAuthService: XeroOAuthService | null;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  userService: UserService;
  watchlistService: WatchlistService;
  artistWatchlistService: ArtistWatchlistService;
  notificationService: NotificationService;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  notificationDispatcher: NotificationDispatcher;
  notificationFactory: NotificationFactory;
  emailService: IEmailService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  userSuspensionChecker: IUserSuspensionChecker;
  registrationService: RegistrationService;
  invitationService: InvitationService;
  profileService: ProfileService;
  addressService: AddressService;
  analyticsService: AnalyticsService;
  accountLinkingService: AccountLinkingService;
  domainEventPublisher: DomainEventPublisher;
  /** admin KYB status transitions + domain events. */
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  /** timeout audit + shared legal-entity middleware (impersonation cookie). */
  impersonationAuditService: ImpersonationAuditService;
  impersonationSessionService: ImpersonationSessionService;
  requireLegalEntityContext: ReturnType<typeof createRequireLegalEntityContext>;
  requireSubmissionsLegalEntityContext: ReturnType<typeof createSubmissionsLegalEntityContext>;
  adminUserService: AdminUserService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  httpErrorHandler: ErrorHandlerService;
  itemSubmissionRepository: IItemSubmissionRepository;
  itemSubmissionService: IItemSubmissionService;
  /** legal entity repository (membership + acting context). */
  legalEntityRepository: ILegalEntityRepository;
  /** role-aware notification recipient lookup for legal entities. */
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader;
  /** KYC (Stripe Identity). */
  kycRepository: IKycRepository;
  kycService: IKycService;
  /** organisation onboarding. */
  organizationOnboardingService: IOrganizationOnboardingService;
  /** organisation multi-step onboarding (Phase D). */
  organizationOnboardingFlowService: OrganizationOnboardingFlowService;
  /** artist registry (search, merge, review). */
  artistRegistryService: IArtistRegistryService;
  /** Stripe Connect Express. */
  stripeConnectService: IStripeConnectService;
  /** legal entity member management (invites, role changes, transfers). */
  memberManagementService: IMemberManagementService;
  /** payout aggregation + admin settlement controls. */
  payoutRepository: IPayoutRepository;
  payoutService: IPayoutService;
  objectStorage: IObjectStorage;
  mediaUrlResolver: MediaUrlResolver;
  uploadService: UploadService;
  uploadValidationQueue: Queue;
  imageCleanupQueue: Queue;
  marketingSyncQueue: Queue;
  /** BullMQ queue consumed by worker to render payout PDFs to Spaces. */
  payoutStatementQueue: Queue<{ payoutId: string }>;
  /** cascade work when a legal entity is archived (proxies, lots flag, member email). */
  legalEntityArchiveQueue: Queue<{ legalEntityId: string }>;
  /** Service for handling Stripe payment webhooks (disputes, refunds). */
  stripePaymentWebhookService: StripePaymentWebhookService | null;
};

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL_API ?? env.DATABASE_URL);
  const authDb = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL);
  const bullConnection = connectionOptionsFromRedisUrl(env.REDIS_URL);
  const emailQueue = new Queue<{ outboxId: string }>("email", { connection: bullConnection });
  const emailService: IEmailService =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailService(db, emailQueue)
      : new ConsoleEmailService(db, emailQueue);
  const jwksAdapter = createJwksAdapter(authDb);

  const ensurePersonalLegalEntityService = new EnsurePersonalLegalEntityService(db);

  const auth = createAuth({
    db: authDb,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    issuerURL: env.OIDC_ISSUER_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
    cookieDomain: env.COOKIE_DOMAIN,
    webOrigin: env.WEB_ORIGIN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    appleClientId: env.APPLE_CLIENT_ID,
    appleClientSecret: env.APPLE_CLIENT_SECRET,
    email: emailService,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    onUserCreated: async (authUser) => {
      await ensurePersonalLegalEntityService.ensure({
        userId: authUser.id,
        displayName: authUser.name,
        email: authUser.email,
      });
    },
  });

  const issuer = env.OIDC_ISSUER_URL ?? env.API_PUBLIC_URL;
  const authenticator: IAuthenticator = new CompositeAuthenticator([
    new BetterAuthAuthenticator(auth),
    new JwtAuthenticator({
      issuer,
      jwksUrl: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
    }),
  ]);
  const repoFactory: IRepositoryFactory = new DrizzleRepositoryFactory(db);
  const lotRepo = repoFactory.root.lot;
  const saleRepo = new DrizzleSaleRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const itemSubmissionRepository = new DrizzleItemSubmissionRepository(db);
  const legalEntityRepository = new DrizzleLegalEntityRepository(db);
  const legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader =
    new DrizzleLegalEntityNotificationRecipientRepository(db);
  const kycRepository = new DrizzleKycRepository(db);
  const kycService: IKycService = new StripeKycService(env, kycRepository);
  const domainEventPublisher = new DomainEventPublisher();
  const organizationOnboardingService: IOrganizationOnboardingService =
    new OrganizationOnboardingService(db, domainEventPublisher);
  const organizationOnboardingFlowService = new OrganizationOnboardingFlowService(
    db,
    legalEntityRepository,
    organizationOnboardingService,
    domainEventPublisher,
  );
  const legalEntityArchiveQueue = new Queue<{ legalEntityId: string }>("legal-entity-archive", {
    connection: bullConnection,
  });
  const legalEntityLifecycleAdminService = new LegalEntityLifecycleAdminService(
    db,
    domainEventPublisher,
    {
      enqueueArchiveCascade: async (legalEntityId: string) => {
        await legalEntityArchiveQueue.add(
          "cascade",
          { legalEntityId },
          { removeOnComplete: 200, attempts: 3, backoff: { type: "exponential", delay: 2000 } },
        );
      },
    },
  );
  const impersonationAuditService = new ImpersonationAuditService(db, domainEventPublisher);
  const impersonationSessionService = new ImpersonationSessionService(db);
  const requireLegalEntityContext = createRequireLegalEntityContext(legalEntityRepository, {
    impersonationSessions: impersonationSessionService,
    onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
  });
  const requireSubmissionsLegalEntityContext = createSubmissionsLegalEntityContext(
    legalEntityRepository,
    {
      impersonationSessions: impersonationSessionService,
      onImpersonationExpired: (input) => impersonationAuditService.recordSessionTimedOut(input),
    },
  );
  const artistRegistryService: IArtistRegistryService = new ArtistRegistryService(
    db,
    domainEventPublisher,
  );
  const memberManagementService: IMemberManagementService = new MemberManagementService(
    db,
    domainEventPublisher,
  );
  const payoutRepository: IPayoutRepository = new DrizzlePayoutRepository(db);
  const payoutService: IPayoutService = new PayoutService(
    payoutRepository,
    db,
    domainEventPublisher,
  );
  const stripeConnectService: IStripeConnectService = new StripeConnectService(
    env,
    db,
    payoutService,
    payoutRepository,
    domainEventPublisher,
  );

  const stripePaymentWebhookService: StripePaymentWebhookService | null =
    env.STRIPE_SECRET_KEY && env.STRIPE_PAYMENTS_WEBHOOK_SECRET
      ? new StripePaymentWebhookService(db, payoutRepository, domainEventPublisher)
      : null;

  const categoryRepo = new DrizzleCategoryRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const artistWatchlistRepo = new DrizzleArtistWatchlistRepository(db);
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const notificationWriteRepo = new DrizzleNotificationWriteRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const notificationPreferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  const emailObservabilityRepository = new DrizzleEmailObservabilityRepository(db);
  const pushSubscriptionRepository = new DrizzlePushSubscriptionRepository(db);
  const profileRepo = new DrizzleProfileRepository(db);
  const addressRepo = new DrizzleAddressRepository(db);
  const invoiceAddressingService = new InvoiceAddressingService(
    paymentRepo,
    legalEntityRepository,
    profileRepo,
    addressRepo,
    createBaseLogger(env).child({ component: "invoice_addressing" }),
  );
  const userSuspensionChecker = new DrizzleUserSuspensionChecker(db);

  const cache = new RedisCacheProvider(redis);
  const notifier = new RedisNotificationSender(redis);
  const userNotificationPublisher = new RedisUserNotificationPublisher(redis);
  const notificationService = new NotificationService(notifier, notifier);
  const strategyFactory = new LotStrategyFactory();
  const notificationFactory = new NotificationFactory();
  const antiShillingGuard: IAntiShillingGuard = new DrizzleAntiShillingRepository(db);

  const quietHoursChecker = new QuietHoursChecker();
  const pushSender: IPushSender =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
      : new NoOpPushSender();

  const inAppChannel = new InAppNotificationChannel(
    notificationWriteRepo,
    userNotificationPublisher,
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

  const publicUploadBase = `${env.API_PUBLIC_URL.replace(/\/$/, "")}/static/uploads`;
  const objectStorage: IObjectStorage =
    env.STORAGE_DRIVER === "s3"
      ? new S3ObjectStorage({
          bucket: env.S3_BUCKET as string,
          region: env.S3_REGION as string,
          endpoint: env.S3_ENDPOINT,
          accessKeyId: env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          publicBaseUrl:
            env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`,
        })
      : new LocalDiskObjectStorage(join(process.cwd(), env.STORAGE_LOCAL_ROOT), publicUploadBase);

  const lotLifecycleService = new LotLifecycleService(
    repoFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
    antiShillingGuard,
    domainEventPublisher,
  );

  const saleLifecycleService = new SaleLifecycleService(saleRepo, lotRepo);

  const uploadValidationQueue = new Queue("validate-upload", { connection: bullConnection });
  const imageCleanupQueue = new Queue("image-cleanup", { connection: bullConnection });
  const marketingSyncQueue = new Queue("marketing-sync", { connection: bullConnection });
  const payoutStatementQueue = new Queue<{ payoutId: string }>("payout-statements", {
    connection: bullConnection,
  });
  const mediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    env.SIGNED_GET_TTL_SEC,
  );
  const imageCleanupService = new ImageCleanupService(objectStorage, imageCleanupQueue);
  const uploadService = new UploadService(
    objectStorage,
    db,
    redis,
    uploadValidationQueue,
    mediaUrlResolver,
  );
  const lotJobScheduler: ILotJobScheduler = new LotJobScheduler(
    bullConnection,
    (lotId) => lotLifecycleService.processActivateJob(lotId),
    (lotId) => lotLifecycleService.processEndJob(lotId),
  );

  const lotNotificationCoordinator = new LotNotificationCoordinator(
    notificationWriteRepo,
    userNotificationPublisher,
  );

  const lotService = new LotService(
    lotRepo,
    repoFactory.root.bid,
    watchlistRepo,
    lotJobScheduler,
    lotNotificationCoordinator,
    imageCleanupService,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    stripeConnectService.isConfigured(),
    db,
    domainEventPublisher,
  );

  const saleService = new SaleService(saleRepo, lotRepo, lotJobScheduler, imageCleanupService);
  const saleStatusTransitionService = new SaleStatusTransitionService(
    saleRepo,
    lotRepo,
    lotJobScheduler,
  );

  const saleFollowRepo = new DrizzleSaleFollowRepository(db);
  const saleBiddersReader = new DrizzleSaleBiddersReader(db);
  const saleFollowService = new SaleFollowService(saleFollowRepo, saleRepo);
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
  );

  const categoryService = new CategoryService(categoryRepo);
  const artistProfileService = new ArtistProfileService(
    new DrizzleArtistProfileRepository(db),
    artistRegistryService,
  );
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);

  const xeroConnRepo = new DrizzleXeroConnectionRepository(db);
  const paymentExtRepo = new DrizzlePaymentExternalRefRepository(db);
  const xeroWebhookEventRepository = new DrizzleXeroWebhookEventRepository(db);

  const errorReporter = env.SENTRY_DSN_API ? new SentryErrorReporter() : new NoOpErrorReporter();

  const xeroEnvEnabled = Boolean(
    env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI,
  );

  const paymentServiceRef: { current?: PaymentService } = {};

  const accountingProvider: IPaymentAccountingProvider = xeroEnvEnabled
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
        async (paymentId) => {
          const svc = paymentServiceRef.current;
          if (svc) {
            await svc.markCapturedFromProviderSync(paymentId);
          }
        },
        legalEntityRepository,
        invoiceAddressingService,
        errorReporter,
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
      )
    : null;

  const stripePaymentGateway = new StripePaymentGateway(env);

  const paymentService = new PaymentService(
    lotRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
    userRepo,
    accountingProvider,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    db,
    domainEventPublisher,
    stripePaymentGateway,
  );
  paymentServiceRef.current = paymentService;

  const xeroOAuthService = xeroEnvEnabled ? new XeroOAuthService(redis, env, xeroConnRepo) : null;

  const adminMetricsService = new AdminMetricsService(
    repoFactory,
    redis,
    itemSubmissionService,
    paymentService,
  );

  const saleModeLookup = new DrizzleSaleModeLookup(db);

  const bidService = new BidService(
    repoFactory,
    strategyFactory,
    cache,
    notificationService,
    notificationDispatcher,
    lotJobScheduler,
    adminMetricsService,
    saleModeLookup,
    antiShillingGuard,
    domainEventPublisher,
    legalEntityRepository,
  );
  const userService = new UserService(userRepo);
  const watchlistService = new WatchlistService(watchlistRepo, lotRepo);
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

  const invitationRepository = new DrizzleUserInvitationRepository(db);
  const invitationService = new InvitationService(
    db,
    invitationRepository,
    userRepo,
    emailService,
    env.WEB_ORIGIN,
  );

  const registrationService = new RegistrationService(
    new ZodRegistrationValidator(),
    new BetterAuthEmailSignupPersister(auth),
    new DrizzleUserProfilePersister(db),
    new NoOpWelcomeNotifier(),
    invitationService,
  );

  const lotMetrics = new DrizzleLotMetricsReader(db);
  const paymentMetrics = new DrizzlePaymentMetricsReader(db);
  const userMetrics = new DrizzleUserMetricsReader(db);
  const metricsAggregator = new DefaultMetricsAggregator();
  const analyticsService = new AnalyticsService(
    lotMetrics,
    paymentMetrics,
    userMetrics,
    metricsAggregator,
  );
  const accountLinkingService = new AccountLinkingService(db);

  const adminUserReader = new DrizzleAdminUserReader(db);
  const adminRoleManager = new DrizzleAdminUserRoleManager(db);
  const adminSuspender = new DrizzleAdminUserSuspender(db);
  const adminActivityReader = new DrizzleAdminUserActivityReader(db);
  const adminUserService = new AdminUserService(
    adminUserReader,
    adminRoleManager,
    adminSuspender,
    adminActivityReader,
  );
  const attentionFeedReader = new DrizzleAttentionFeedReader(db);

  const httpErrorHandler = new ErrorHandlerService(
    new DefaultErrorClassifier(),
    new ConsoleErrorLogger(env),
    errorReporter,
    new JsonErrorResponseBuilder(),
  );

  return {
    env,
    db,
    redis,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    auth,
    getPublicJwks: jwksAdapter.getPublicJwks,
    authenticator,
    repoFactory,
    lotService,
    saleService,
    saleFollowService,
    saleBiddersService,
    lotLifecycleService,
    saleLifecycleService,
    lotJobScheduler,
    saleStatusTransitionService,
    bidService,
    categoryService,
    artistProfileService,
    dashboardQueryService,
    notificationQueryService,
    paymentService,
    accountingProvider,
    invoiceAddressingService,
    xeroPayoutBillWriter,
    xeroOAuthService,
    xeroWebhookEventRepository,
    userService,
    watchlistService,
    artistWatchlistService,
    notificationService,
    notificationPreferenceRepository,
    pushSubscriptionRepository,
    notificationDispatcher,
    notificationFactory,
    emailService,
    emailObservabilityRepository,
    userSuspensionChecker,
    registrationService,
    invitationService,
    profileService,
    addressService,
    analyticsService,
    accountLinkingService,
    domainEventPublisher,
    legalEntityLifecycleAdminService,
    impersonationAuditService,
    impersonationSessionService,
    requireLegalEntityContext,
    requireSubmissionsLegalEntityContext,
    adminUserService,
    adminMetricsService,
    attentionFeedReader,
    httpErrorHandler,
    itemSubmissionRepository,
    itemSubmissionService,
    legalEntityRepository,
    legalEntityNotificationRecipients,
    kycRepository,
    kycService,
    organizationOnboardingService,
    organizationOnboardingFlowService,
    artistRegistryService,
    stripeConnectService,
    memberManagementService,
    payoutRepository,
    payoutService,
    objectStorage,
    mediaUrlResolver,
    uploadService,
    uploadValidationQueue,
    imageCleanupQueue,
    marketingSyncQueue,
    payoutStatementQueue,
    legalEntityArchiveQueue,
    stripePaymentWebhookService,
  };
}
