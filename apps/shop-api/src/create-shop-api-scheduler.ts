import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import { resolveStorefrontOrigins } from "./domain/storefront-origins.js";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleShopPayeeConnectAccountRepository } from "./infrastructure/drizzle-shop-payee-connect-account.repository.js";
import { createDrizzleShopUnitOfWork } from "./infrastructure/drizzle-shop-transaction-effects.js";
import { createRunConnectPayoutTransfersHandler } from "./infrastructure/handlers/scheduler/run-connect-payout-transfers.handler.js";
import { createStripePaymentRefundGateway } from "./infrastructure/stripe-payment-refund.gateway.js";
import { createStripeShopCheckoutGateway } from "./infrastructure/stripe-shop-checkout.gateway.js";
import { createStripeShopConnectGateway } from "./infrastructure/stripe-shop-connect.gateway.js";
import { createShopScheduler } from "./scheduler/create-shop-scheduler.js";
import type { ShopSchedulerHandle } from "./scheduler/create-shop-scheduler.js";
import type { ShopSchedulerTask } from "./scheduler/shop-scheduler-task.js";
import { createAdminCommandPruneTask } from "./scheduler/tasks/admin-command-prune.task.js";
import { createConnectPayoutTransferTask } from "./scheduler/tasks/connect-payout-transfer.task.js";
import { createGuestOrderClaimTask } from "./scheduler/tasks/guest-order-claim.task.js";
import { createIdentityMergeTask } from "./scheduler/tasks/identity-merge.task.js";
import { createNotifyMeDispatchTask } from "./scheduler/tasks/notify-me-dispatch.task.js";
import { createPayoutEligibilityTask } from "./scheduler/tasks/payout-eligibility.task.js";
import { createRefundSubmissionTask } from "./scheduler/tasks/refund-submission.task.js";
import { createRetainedInvoicePurgeTask } from "./scheduler/tasks/retained-invoice-purge.task.js";
import { createStaffAccessTask } from "./scheduler/tasks/staff-access.task.js";
import { createStaleCheckoutReaperTask } from "./scheduler/tasks/stale-checkout-reaper.task.js";
import { createStockHoldExpiryTask } from "./scheduler/tasks/stock-hold-expiry.task.js";

function connectPayoutTransferTasks(input: {
  db: Database;
  env: ShopApiEnv;
  log: FastifyBaseLogger;
}): ShopSchedulerTask[] {
  const { env } = input;
  if (!env.SHOP_PAYOUTS_ENABLED || !env.SHOP_CONNECT_TRANSFERS_ENABLED || !env.STRIPE_SECRET_KEY) {
    return [];
  }
  const platformKey = env.STRIPE_SHOP_CONNECT_PLATFORM_KEY;
  const run = createRunConnectPayoutTransfersHandler({
    db: input.db,
    uow: createDrizzleShopUnitOfWork(input.db, env.DOMAIN_EVENT_PUBLISH_VALIDATE),
    accounts: createDrizzleShopPayeeConnectAccountRepository(input.db, platformKey),
    gateway: createStripeShopConnectGateway({ secretKey: env.STRIPE_SECRET_KEY, platformKey }),
    platformKey,
  });
  return [createConnectPayoutTransferTask(run, input.log)];
}

export function buildShopApiSchedulerTasks(input: {
  db: Database;
  env: ShopApiEnv;
  log: FastifyBaseLogger;
}): ShopSchedulerTask[] {
  const notifications = createDrizzleShopNotificationPublisher();
  const paymentGateway = createStripeShopCheckoutGateway({
    secretKey: input.env.STRIPE_SECRET_KEY,
    storefrontUrl: input.env.SHOP_STOREFRONT_URL,
    fakeCheckoutEnabled: input.env.SHOP_FAKE_CHECKOUT_ENABLED,
  });
  const opsAlertEmail =
    input.env.SHOP_OPS_ALERT_EMAIL ?? input.env.SHOP_ENQUIRY_NOTIFICATION_EMAIL ?? null;
  return [
    createStaleCheckoutReaperTask(input.db, paymentGateway),
    createIdentityMergeTask(input.db, opsAlertEmail),
    createGuestOrderClaimTask(input.db, input.env),
    createRetainedInvoicePurgeTask(input.db),
    createStaffAccessTask(input.db, opsAlertEmail),
    createNotifyMeDispatchTask(input.db, {
      notifications,
      storefrontOrigins: resolveStorefrontOrigins({
        shopStorefrontUrl: input.env.SHOP_STOREFRONT_URL,
        laxArtPublicUrl: input.env.LAX_ART_PUBLIC_URL,
      }),
    }),
    ...(input.env.SHOP_PAYOUTS_ENABLED ? [createPayoutEligibilityTask(input.db)] : []),
    ...connectPayoutTransferTasks(input),
    createRefundSubmissionTask(
      input.db,
      createStripePaymentRefundGateway({ secretKey: input.env.STRIPE_SECRET_KEY }),
      opsAlertEmail,
    ),
    createAdminCommandPruneTask(input.db),
    ...(input.env.SHOP_THIRD_PARTY_ENABLED
      ? [createStockHoldExpiryTask(input.db, input.env.DOMAIN_EVENT_PUBLISH_VALIDATE)]
      : []),
  ];
}

export function createShopApiScheduler(input: {
  db: Database;
  env: ShopApiEnv;
  log: FastifyBaseLogger;
}): ShopSchedulerHandle | null {
  if (!input.env.SHOP_SCHEDULER_ENABLED) {
    return null;
  }
  return createShopScheduler({
    db: input.db,
    log: input.log,
    intervalMs: input.env.SHOP_SCHEDULER_INTERVAL_MS,
    tasks: buildShopApiSchedulerTasks(input),
  });
}
