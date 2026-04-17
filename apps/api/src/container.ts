import { createAuth } from "@auction/auth/server";
import type { Auth } from "@auction/auth/server";
import { createDb } from "@auction/db";
import { Redis } from "ioredis";
import type { Env } from "./env.js";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { InAppNotificationChannel } from "./infrastructure/in-app-notification.channel.js";
import { NoOpPushSender } from "./infrastructure/no-op-push.sender.js";
import { PushNotificationChannel } from "./infrastructure/push-notification.channel.js";
import { RedisCacheProvider } from "./infrastructure/redis-cache.provider.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import { RedisUserNotificationPublisher } from "./infrastructure/redis-user-notification.publisher.js";
import { WebPushSender } from "./infrastructure/web-push.sender.js";
import { AuctionJobScheduler } from "./jobs/auction-job-scheduler.js";
import { connectionOptionsFromRedisUrl } from "./lib/redis-url.js";
import { DrizzleCategoryRepository } from "./repositories/drizzle-category.repository.js";
import { DrizzleNotificationPreferenceRepository } from "./repositories/drizzle-notification-preference.repository.js";
import { DrizzleNotificationReadRepository } from "./repositories/drizzle-notification-read.repository.js";
import { DrizzleNotificationWriteRepository } from "./repositories/drizzle-notification-write.repository.js";
import { DrizzlePaymentRepository } from "./repositories/drizzle-payment.repository.js";
import { DrizzlePushSubscriptionRepository } from "./repositories/drizzle-push-subscription.repository.js";
import { DrizzleRepositoryFactory } from "./repositories/drizzle-repository.factory.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user.repository.js";
import { DrizzleWatchlistRepository } from "./repositories/drizzle-watchlist.repository.js";
import { AuctionLifecycleService } from "./services/auction-lifecycle.service.js";
import { AuctionService } from "./services/auction.service.js";
import { BidService } from "./services/bid.service.js";
import { CategoryService } from "./services/category.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IPushSender } from "./services/interfaces/push.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { NotificationDispatcher } from "./services/notification.dispatcher.js";
import { NotificationFactory } from "./services/notification.factory.js";
import { NotificationService } from "./services/notification.service.js";
import { PaymentService } from "./services/payment.service.js";
import { QuietHoursChecker } from "./services/quiet-hours.checker.js";
import { UserService } from "./services/user.service.js";
import { WatchlistService } from "./services/watchlist.service.js";
import { AuctionStrategyFactory } from "./strategies/strategy.factory.js";

export type Container = {
  db: ReturnType<typeof createDb>;
  redis: Redis;
  /** Exposed for web push subscription (public key only). */
  vapidPublicKey: string | null;
  auth: Auth;
  authenticator: IAuthenticator;
  repoFactory: IRepositoryFactory;
  auctionService: AuctionService;
  auctionLifecycleService: AuctionLifecycleService;
  auctionJobScheduler: AuctionJobScheduler;
  bidService: BidService;
  categoryService: CategoryService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
  userService: UserService;
  watchlistService: WatchlistService;
  notificationService: NotificationService;
  notificationPreferenceRepository: DrizzleNotificationPreferenceRepository;
  pushSubscriptionRepository: DrizzlePushSubscriptionRepository;
  notificationDispatcher: NotificationDispatcher;
  notificationFactory: NotificationFactory;
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
  const auctionRepo = repoFactory.root.auction;
  const userRepo = new DrizzleUserRepository(db);
  const categoryRepo = new DrizzleCategoryRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const notificationWriteRepo = new DrizzleNotificationWriteRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const notificationPreferenceRepository = new DrizzleNotificationPreferenceRepository(db);
  const pushSubscriptionRepository = new DrizzlePushSubscriptionRepository(db);

  const cache = new RedisCacheProvider(redis);
  const notifier = new RedisNotificationSender(redis);
  const userNotificationPublisher = new RedisUserNotificationPublisher(redis);
  const notificationService = new NotificationService(notifier, notifier);
  const strategyFactory = new AuctionStrategyFactory();
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

  const auctionLifecycleService = new AuctionLifecycleService(
    auctionRepo,
    repoFactory.root.bid,
    strategyFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
  );

  const bullConnection = connectionOptionsFromRedisUrl(env.REDIS_URL);
  const auctionJobScheduler = new AuctionJobScheduler(
    bullConnection,
    (auctionId) => auctionLifecycleService.processActivateJob(auctionId),
    (auctionId) => auctionLifecycleService.processEndJob(auctionId),
  );

  const auctionService = new AuctionService(
    auctionRepo,
    repoFactory.root.bid,
    watchlistRepo,
    notificationWriteRepo,
    userNotificationPublisher,
    auctionJobScheduler,
  );

  const bidService = new BidService(
    repoFactory,
    strategyFactory,
    cache,
    notificationService,
    notificationDispatcher,
    auctionJobScheduler,
  );

  const categoryService = new CategoryService(categoryRepo);
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);
  const paymentService = new PaymentService(
    auctionRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
  );
  const userService = new UserService(userRepo);
  const watchlistService = new WatchlistService(watchlistRepo, auctionRepo);

  return {
    db,
    redis,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
    auth,
    authenticator,
    repoFactory,
    auctionService,
    auctionLifecycleService,
    auctionJobScheduler,
    bidService,
    categoryService,
    dashboardQueryService,
    notificationQueryService,
    paymentService,
    userService,
    watchlistService,
    notificationService,
    notificationPreferenceRepository,
    pushSubscriptionRepository,
    notificationDispatcher,
    notificationFactory,
  };
}
