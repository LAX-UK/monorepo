import { createDb } from "@auction/db";
import { createAuth } from "@auction/auth/server";
import { Redis } from "ioredis";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { DrizzleRepositoryFactory } from "./repositories/drizzle-repository.factory.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user.repository.js";
import { DrizzleCategoryRepository } from "./repositories/drizzle-category.repository.js";
import { DrizzleWatchlistRepository } from "./repositories/drizzle-watchlist.repository.js";
import { DrizzleNotificationReadRepository } from "./repositories/drizzle-notification-read.repository.js";
import { DrizzlePaymentRepository } from "./repositories/drizzle-payment.repository.js";
import { AuctionService } from "./services/auction.service.js";
import { AuctionLifecycleService } from "./services/auction-lifecycle.service.js";
import { BidService } from "./services/bid.service.js";
import { CategoryService } from "./services/category.service.js";
import { DashboardQueryService } from "./services/dashboard-query.service.js";
import { NotificationQueryService } from "./services/notification-query.service.js";
import { PaymentService } from "./services/payment.service.js";
import { UserService } from "./services/user.service.js";
import { WatchlistService } from "./services/watchlist.service.js";
import { NotificationService } from "./services/notification.service.js";
import { AuctionStrategyFactory } from "./strategies/strategy.factory.js";
import { RedisCacheProvider } from "./infrastructure/redis-cache.provider.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import type { Env } from "./env.js";
import type { Auth } from "@auction/auth/server";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";
import type { IRepositoryFactory } from "./services/interfaces/repository-factory.js";

export type Container = {
  db: ReturnType<typeof createDb>;
  redis: Redis;
  auth: Auth;
  authenticator: IAuthenticator;
  repoFactory: IRepositoryFactory;
  auctionService: AuctionService;
  auctionLifecycleService: AuctionLifecycleService;
  bidService: BidService;
  categoryService: CategoryService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
  paymentService: PaymentService;
  userService: UserService;
  watchlistService: WatchlistService;
  notificationService: NotificationService;
};

export function createContainer(env: Env): Container {
  const db = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL);

  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_PUBLIC_URL,
    trustedOrigins: [env.WEB_ORIGIN],
  });

  const authenticator: IAuthenticator = new BetterAuthAuthenticator(auth);
  const repoFactory: IRepositoryFactory = new DrizzleRepositoryFactory(db);
  const auctionRepo = repoFactory.root.auction;
  const userRepo = new DrizzleUserRepository(db);
  const categoryRepo = new DrizzleCategoryRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const notificationReadRepo = new DrizzleNotificationReadRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);

  const cache = new RedisCacheProvider(redis);
  const notifier = new RedisNotificationSender(redis);
  const notificationService = new NotificationService(notifier, notifier);
  const strategyFactory = new AuctionStrategyFactory();

  const auctionService = new AuctionService(auctionRepo);
  const auctionLifecycleService = new AuctionLifecycleService(auctionRepo, repoFactory.root.bid);
  const bidService = new BidService(repoFactory, strategyFactory, cache, notificationService);
  const categoryService = new CategoryService(categoryRepo);
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);
  const paymentService = new PaymentService(auctionRepo, paymentRepo);
  const userService = new UserService(userRepo);
  const watchlistService = new WatchlistService(watchlistRepo, auctionRepo);

  return {
    db,
    redis,
    auth,
    authenticator,
    repoFactory,
    auctionService,
    auctionLifecycleService,
    bidService,
    categoryService,
    dashboardQueryService,
    notificationQueryService,
    paymentService,
    userService,
    watchlistService,
    notificationService,
  };
}
