import { join } from "node:path";
import { createAuth } from "@auction/auth/server";
import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import { Redis } from "ioredis";
import type { Env } from "./env.js";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { BetterAuthEmailSignupPersister } from "./infrastructure/better-auth-email-signup.persister.js";
import { ConsoleErrorLogger } from "./infrastructure/console-error.logger.js";
import { DefaultErrorClassifier } from "./infrastructure/default-error.classifier.js";
import { InAppNotificationChannel } from "./infrastructure/in-app-notification.channel.js";
import { JsonErrorResponseBuilder } from "./infrastructure/json-error-response.builder.js";
import { LocalDiskObjectStorage } from "./infrastructure/local-disk-object-storage.js";
import { NoOpErrorReporter } from "./infrastructure/no-op-error.reporter.js";
import { NoOpPushSender } from "./infrastructure/no-op-push.sender.js";
import { NoOpWelcomeNotifier } from "./infrastructure/no-op-welcome.notifier.js";
import { PushNotificationChannel } from "./infrastructure/push-notification.channel.js";
import { RedisCacheProvider } from "./infrastructure/redis-cache.provider.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import { RedisUserNotificationPublisher } from "./infrastructure/redis-user-notification.publisher.js";
import { S3ObjectStorage } from "./infrastructure/s3-object-storage.js";
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
import { DrizzleCategoryRepository } from "./repositories/drizzle-category.repository.js";
import { DrizzleItemSubmissionRepository } from "./repositories/drizzle-item-submission.repository.js";
import { DrizzleLotMetricsReader } from "./repositories/drizzle-lot-metrics.reader.js";
import { DrizzleNotificationPreferenceRepository } from "./repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "./repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "./repositories/drizzle-notification-write.repository.js";
import { DrizzlePaymentMetricsReader } from "./repositories/drizzle-payment-metrics.reader.js";
import { DrizzlePaymentRepository } from "./repositories/drizzle-payment.repository.js";
import { DrizzleProfileRepository } from "./repositories/drizzle-profile.repository.js";
import { DrizzlePushSubscriptionRepository } from "./repositories/drizzle-push-subscription.repository.js";
import { DrizzleRepositoryFactory } from "./repositories/drizzle-repository.factory.js";
import { DrizzleSaleRepository } from "./repositories/drizzle-sale.repository.js";
import { DrizzleUserMetricsReader } from "./repositories/drizzle-user-metrics.reader.js";
import { DrizzleUserSuspensionChecker } from "./repositories/drizzle-user-suspension.checker.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user.repository.js";
import { DrizzleArtistWatchlistRepository } from "./repositories/drizzle-artist-watchlist.repository.js";
import { DrizzleWatchlistRepository } from "./repositories/drizzle-watchlist.repository.js";
import { AddressService } from "./services/address.service.js";
import { AdminMetricsService } from "./services/admin-metrics.service.js";
import { AdminUserService } from "./services/admin-user.service.js";
import { AnalyticsService } from "./services/analytics.service.js";
import { BidService } from "./services/bid.service.js";
import { CategoryService } from "./services/category.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import { DefaultMetricsAggregator } from "./services/default-metrics.aggregator.js";
import { ErrorHandlerService } from "./services/error-handler.service.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IItemSubmissionService } from "./services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "./services/interfaces/job-scheduler.js";
import type { INotificationPreferenceRepository } from "./services/interfaces/notification-preference.js";
import type { IObjectStorage } from "./services/interfaces/object-storage.js";
import type { IPushSubscriptionRepository } from "./services/interfaces/push.js";
import type { IPushSender } from "./services/interfaces/push.js";
import type { IItemSubmissionRepository } from "./services/interfaces/repositories.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import type { IUserSuspensionChecker } from "./services/interfaces/user-suspension.js";
import { ItemSubmissionService } from "./services/item-submission.service.js";
import { LotLifecycleService } from "./services/lot-lifecycle.service.js";
import { LotNotificationCoordinator } from "./services/lot-notification-coordinator.js";
import { LotService } from "./services/lot.service.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { NotificationDispatcher } from "./services/notification.dispatcher.js";
import { NotificationFactory } from "./services/notification.factory.js";
import { NotificationService } from "./services/notification.service.js";
import { PaymentService } from "./services/payment.service.js";
import { ProfileService } from "./services/profile.service.js";
import { QuietHoursChecker } from "./services/quiet-hours.checker.js";
import { RegistrationService } from "./services/registration.service.js";
import { SaleLifecycleService } from "./services/sale-lifecycle.service.js";
import { SaleService } from "./services/sale.service.js";
import { UploadService } from "./services/upload.service.js";
import { UserService } from "./services/user.service.js";
import { ArtistWatchlistService } from "./services/artist-watchlist.service.js";
import { WatchlistService } from "./services/watchlist.service.js";
import { LotStrategyFactory } from "./strategies/strategy.factory.js";

export type Container = {
  db: ReturnType<typeof createDb>;
  redis: Redis;
  /** Exposed for web push subscription (public key only). */
  vapidPublicKey: string | null;
  auth: Auth;
  authenticator: IAuthenticator;
  repoFactory: IRepositoryFactory;
  lotService: LotService;
  saleService: SaleService;
  lotLifecycleService: LotLifecycleService;
  saleLifecycleService: SaleLifecycleService;
  lotJobScheduler: ILotJobScheduler;
  bidService: BidService;
  categoryService: CategoryService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
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
  profileService: ProfileService;
  addressService: AddressService;
  analyticsService: AnalyticsService;
  adminUserService: AdminUserService;
  adminMetricsService: AdminMetricsService;
  httpErrorHandler: ErrorHandlerService;
  itemSubmissionRepository: IItemSubmissionRepository;
  itemSubmissionService: IItemSubmissionService;
  objectStorage: IObjectStorage;
  uploadService: UploadService;
};

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL);

  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
  });

  const authenticator: IAuthenticator = new BetterAuthAuthenticator(auth);
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

  const itemSubmissionService = new ItemSubmissionService(
    db,
    itemSubmissionRepository,
    lotRepo,
    userRepo,
    notificationDispatcher,
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
  const uploadService = new UploadService(objectStorage);

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
  );

  const saleService = new SaleService(saleRepo, lotRepo, lotJobScheduler);

  const categoryService = new CategoryService(categoryRepo);
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);
  const paymentService = new PaymentService(
    lotRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
  );

  const adminMetricsService = new AdminMetricsService(
    repoFactory,
    redis,
    itemSubmissionService,
    paymentService,
  );

  const bidService = new BidService(
    repoFactory,
    strategyFactory,
    cache,
    notificationService,
    notificationDispatcher,
    lotJobScheduler,
    adminMetricsService,
  );
  const userService = new UserService(userRepo);
  const watchlistService = new WatchlistService(watchlistRepo, lotRepo);
  const artistWatchlistService = new ArtistWatchlistService(artistWatchlistRepo, userRepo);
  const profileService = new ProfileService(profileRepo, profileRepo);
  const addressService = new AddressService(addressRepo);

  const registrationService = new RegistrationService(
    new ZodRegistrationValidator(),
    new BetterAuthEmailSignupPersister(auth),
    new DrizzleUserProfilePersister(db),
    new NoOpWelcomeNotifier(),
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

  const httpErrorHandler = new ErrorHandlerService(
    new DefaultErrorClassifier(),
    new ConsoleErrorLogger(env),
    new NoOpErrorReporter(),
    new JsonErrorResponseBuilder(),
  );

  return {
    db,
    redis,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    auth,
    authenticator,
    repoFactory,
    lotService,
    saleService,
    lotLifecycleService,
    saleLifecycleService,
    lotJobScheduler,
    bidService,
    categoryService,
    dashboardQueryService,
    notificationQueryService,
    paymentService,
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
    profileService,
    addressService,
    analyticsService,
    adminUserService,
    adminMetricsService,
    httpErrorHandler,
    itemSubmissionRepository,
    itemSubmissionService,
    objectStorage,
    uploadService,
  };
}
