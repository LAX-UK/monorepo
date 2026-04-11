import { createDb } from "@auction/db";
import { createAuth } from "@auction/auth/server";
import { Redis } from "ioredis";
import { BetterAuthAuthenticator } from "./infrastructure/better-auth-authenticator.js";
import { DrizzleRepositoryFactory } from "./repositories/drizzle-repository.factory.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user.repository.js";
import { AuctionService } from "./services/auction.service.js";
import { BidService } from "./services/bid.service.js";
import { UserService } from "./services/user.service.js";
import { NotificationService } from "./services/notification.service.js";
import { AuctionStrategyFactory } from "./strategies/strategy.factory.js";
import { RedisCacheProvider } from "./infrastructure/redis-cache.provider.js";
import { RedisNotificationSender } from "./infrastructure/redis-notification.sender.js";
import type { Env } from "./env.js";
import type { Auth } from "@auction/auth/server";

export type Container = {
  db: ReturnType<typeof createDb>;
  redis: Redis;
  auth: Auth;
  authenticator: BetterAuthAuthenticator;
  repoFactory: DrizzleRepositoryFactory;
  auctionService: AuctionService;
  bidService: BidService;
  userService: UserService;
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

  const authenticator = new BetterAuthAuthenticator(auth);
  const repoFactory = new DrizzleRepositoryFactory(db);
  const auctionRepo = repoFactory.root.auction;
  const userRepo = new DrizzleUserRepository(db);
  const cache = new RedisCacheProvider(redis);
  const notifier = new RedisNotificationSender(redis);
  const notificationService = new NotificationService(notifier);
  const strategyFactory = new AuctionStrategyFactory();

  const auctionService = new AuctionService(auctionRepo);
  const bidService = new BidService(repoFactory, strategyFactory, cache, notificationService);
  const userService = new UserService(userRepo);

  return {
    db,
    redis,
    auth,
    authenticator,
    repoFactory,
    auctionService,
    bidService,
    userService,
    notificationService,
  };
}
