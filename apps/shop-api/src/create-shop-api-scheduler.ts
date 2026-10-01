import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createStripeShopCheckoutGateway } from "./infrastructure/stripe-shop-checkout.gateway.js";
import { createShopScheduler } from "./scheduler/create-shop-scheduler.js";
import type { ShopSchedulerHandle } from "./scheduler/create-shop-scheduler.js";
import { createNotifyMeDispatchTask } from "./scheduler/tasks/notify-me-dispatch.task.js";
import { createStaleCheckoutReaperTask } from "./scheduler/tasks/stale-checkout-reaper.task.js";

export function createShopApiScheduler(input: {
  db: Database;
  env: ShopApiEnv;
  log: FastifyBaseLogger;
}): ShopSchedulerHandle | null {
  if (!input.env.SHOP_SCHEDULER_ENABLED) {
    return null;
  }
  const notifications = createDrizzleShopNotificationPublisher();
  const paymentGateway = createStripeShopCheckoutGateway({
    secretKey: input.env.STRIPE_SECRET_KEY,
    storefrontUrl: input.env.SHOP_STOREFRONT_URL,
    fakeCheckoutEnabled: input.env.SHOP_FAKE_CHECKOUT_ENABLED,
  });
  return createShopScheduler({
    db: input.db,
    log: input.log,
    intervalMs: input.env.SHOP_SCHEDULER_INTERVAL_MS,
    tasks: [
      createStaleCheckoutReaperTask(input.db, paymentGateway),
      createNotifyMeDispatchTask(input.db, {
        notifications,
        storefrontUrl: input.env.SHOP_STOREFRONT_URL,
      }),
    ],
  });
}
