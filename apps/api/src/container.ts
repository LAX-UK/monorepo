import { join } from "node:path";
import { createJwksAdapter } from "@auction/auth";
import { createAuth } from "@auction/auth/server";
import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { Env } from "./env.js";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { BetterAuthEmailSignupPersister } from "./infrastructure/better-auth-email-signup.persister.js";
import { CompositeAuthenticator } from "./infrastructure/composite-authenticator.js";
import { ConsoleErrorLogger } from "./infrastructure/console-error.logger.js";
import { DefaultErrorClassifier } from "./infrastructure/default-error.classifier.js";
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
import { createTransactionalMailer } from "./infrastructure/transactional-mailer.js";
import { DrizzleUserProfilePersister } from "./infrastructure/user-profile.persister.js";
import { WebPushSender } from "./infrastructure/web-push.sender.js";
import { ZodRegistrationValidator } from "./infrastructure/zod-registration.validator.js";
import { LotJobScheduler } from "./jobs/lot-job-scheduler.js";
import { connectionOptionsFromRedisUrl } from "./lib/redis-url.js";
import { DrizzleAddressRepository } from "./repositories/drizzle-address.repository.js";
import {
  DrizzleAdminUserActivityReader,
  DrizzleAdminUserReader,
  DrizzleAdminUserRoleManager,
  DrizzleAdminUserSuspender,
} from "./repositories/drizzle-admin-user.reader.js";
import { DrizzleArtistWatchlistRepository } from "./repositories/drizzle-artist-watchlist.repository.js";
import { DrizzleCategoryRepository } from "./repositories/drizzle-category.repository.js";
import { DrizzleUserInvitationRepository } from "./repositories/drizzle-invitation.repository.js";
import { DrizzleItemSubmissionRepository } from "./repositories/drizzle-item-submission.repository.js";
import { DrizzleLotMetricsReader } from "./repositories/drizzle-lot-metrics.reader.js";
import { DrizzleNotificationPreferenceRepository } from "./repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "./repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "./repositories/drizzle-notification-write.repository.js";
import { DrizzlePaymentExternalRefRepository } from "./repositories/drizzle-payment-external-ref.repository.js";
import { DrizzlePaymentMetricsReader } from "./repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRepository } from "./repositories/drizzle-payment.repository.js";
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
import { AddressService } from "./services/address.service.js";
import { AdminMetricsService } from "./services/admin-metrics.service.js";
import { AdminUserService } from "./services/admin-user.service.js";
import { AnalyticsService } from "./services/analytics.service.js";
import { ArtistWatchlistService } from "./services/artist-watchlist.service.js";
import { DrizzleAttentionFeedReader } from "./services/attention-feed.service.js";
import { BidService } from "./services/bid.service.js";
import { CategoryService } from "./services/category.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import { DefaultMetricsAggregator } from "./services/default-metrics.aggregator.js";
import { DomainEventPublisher } from "./services/domain-event.publisher.js";
import { ErrorHandlerService } from "./services/error-handler.service.js";
import { ImageCleanupService } from "./services/image-cleanup.service.js";
import type { IAttentionFeedReader } from "./services/interfaces/attention-feed.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IItemSubmissionService } from "./services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "./services/interfaces/job-scheduler.js";
import type { INotificationPreferenceRepository } from "./services/interfaces/notification-preference.js";
import type { IObjectStorage } from "./services/interfaces/object-storage.js";
import type { IPaymentAccountingProvider } from "./services/interfaces/payment-accounting-provider.js";
import type { IPushSubscriptionRepository } from "./services/interfaces/push.js";
import type { IPushSender } from "./services/interfaces/push.js";
import type { IItemSubmissionRepository } from "./services/interfaces/repositories.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import type { IUserSuspensionChecker } from "./services/interfaces/user-suspension.js";
import type { IXeroWebhookEventRepository } from "./services/interfaces/xero-repositories.js";
import { InvitationService } from "./services/invitation.service.js";
import { ItemSubmissionService } from "./services/item-submission.service.js";
import { LotLifecycleService } from "./services/lot-lifecycle.service.js";
import { LotNotificationCoordinator } from "./services/lot-notification-coordinator.js";
import { LotService } from "./services/lot.service.js";
import { MediaUrlResolver } from "./services/media-url-resolver.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { NotificationDispatcher } from "./services/notification.dispatcher.js";
import { NotificationFactory } from "./services/notification.factory.js";
import { NotificationService } from "./services/notification.service.js";
import { PaymentService } from "./services/payment.service.js";
import { ProfileService } from "./services/profile.service.js";
import { QuietHoursChecker } from "./services/quiet-hours.checker.js";
import { RegistrationService } from "./services/registration.service.js";
import { SaleBiddersService } from "./services/sale-bidders.service.js";
import { SaleFollowService } from "./services/sale-follow.service.js";
import { SaleLifecycleService } from "./services/sale-lifecycle.service.js";
import { SaleStatusTransitionService } from "./services/sale-status-transition.service.js";
import { SaleService } from "./services/sale.service.js";
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
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
  accountingProvider: IPaymentAccountingProvider;
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
  userSuspensionChecker: IUserSuspensionChecker;
  registrationService: RegistrationService;
  invitationService: InvitationService;
  profileService: ProfileService;
  addressService: AddressService;
  analyticsService: AnalyticsService;
  accountLinkingService: AccountLinkingService;
  domainEventPublisher: DomainEventPublisher;
  adminUserService: AdminUserService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  httpErrorHandler: ErrorHandlerService;
  itemSubmissionRepository: IItemSubmissionRepository;
  itemSubmissionService: IItemSubmissionService;
  objectStorage: IObjectStorage;
  mediaUrlResolver: MediaUrlResolver;
  uploadService: UploadService;
  uploadValidationQueue: Queue;
  imageCleanupQueue: Queue;
};

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL_API ?? env.DATABASE_URL);
  const authDb = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL);
  const jwksAdapter = createJwksAdapter(authDb);

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
  const categoryRepo = new DrizzleCategoryRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const artistWatchlistRepo = new DrizzleArtistWatchlistRepository(db);
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const notificationWriteRepo = new DrizzleNotificationWriteRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const notificationPreferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  const pushSubscriptionRepository = new DrizzlePushSubscriptionRepository(db);
  const profileRepo = new DrizzleProfileRepository(db);
  const addressRepo = new DrizzleAddressRepository(db);
  const userSuspensionChecker = new DrizzleUserSuspensionChecker(db);

  const cache = new RedisCacheProvider(redis);
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
  );
  const pushChannel = new PushNotificationChannel(pushSender, pushSubscriptionRepository);
  const notificationDispatcher = new NotificationDispatcher(
    [inAppChannel, pushChannel],
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
    strategyFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
  );

  const saleLifecycleService = new SaleLifecycleService(saleRepo, lotRepo);

  const bullConnection = connectionOptionsFromRedisUrl(env.REDIS_URL);
  const uploadValidationQueue = new Queue("validate-upload", { connection: bullConnection });
  const imageCleanupQueue = new Queue("image-cleanup", { connection: bullConnection });
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
    lotRepo,
    userRepo,
    notificationDispatcher,
    imageCleanupService,
  );

  const categoryService = new CategoryService(categoryRepo);
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);

  const xeroConnRepo = new DrizzleXeroConnectionRepository(db);
  const paymentExtRepo = new DrizzlePaymentExternalRefRepository(db);
  const xeroWebhookEventRepository = new DrizzleXeroWebhookEventRepository(db);

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
        },
        xeroConnRepo,
        paymentExtRepo,
        async (paymentId) => {
          const svc = paymentServiceRef.current;
          if (svc) {
            await svc.markCapturedFromProviderSync(paymentId);
          }
        },
      )
    : new NoOpAccountingProvider();

  const paymentService = new PaymentService(
    lotRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
    userRepo,
    accountingProvider,
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
  );
  const userService = new UserService(userRepo);
  const watchlistService = new WatchlistService(watchlistRepo, lotRepo);
  const artistWatchlistService = new ArtistWatchlistService(artistWatchlistRepo, userRepo);
  const profileService = new ProfileService(profileRepo, profileRepo, imageCleanupService);
  const addressService = new AddressService(addressRepo);

  const transactionalMailer = createTransactionalMailer(env);
  const invitationRepository = new DrizzleUserInvitationRepository(db);
  const invitationService = new InvitationService(
    db,
    invitationRepository,
    userRepo,
    transactionalMailer,
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
  const domainEventPublisher = new DomainEventPublisher();

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
    new NoOpErrorReporter(),
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
    dashboardQueryService,
    notificationQueryService,
    paymentService,
    accountingProvider,
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
    userSuspensionChecker,
    registrationService,
    invitationService,
    profileService,
    addressService,
    analyticsService,
    accountLinkingService,
    domainEventPublisher,
    adminUserService,
    adminMetricsService,
    attentionFeedReader,
    httpErrorHandler,
    itemSubmissionRepository,
    itemSubmissionService,
    objectStorage,
    mediaUrlResolver,
    uploadService,
    uploadValidationQueue,
    imageCleanupQueue,
  };
}
