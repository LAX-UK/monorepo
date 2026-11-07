import type { AlertRetentionStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import { registerMissingMediaAssets } from "./application/artwork-register/register-media-assets.js";
import { resolveStorefrontOrigins } from "./domain/storefront-origins.js";
import type { ShopApiEnv } from "./env.js";
import { createShopAlertRuntime } from "./infrastructure/alerts/create-shop-alert-runtime.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleShopPayeeConnectAccountRepository } from "./infrastructure/drizzle-shop-payee-connect-account.repository.js";
import { createDrizzleShopUnitOfWork } from "./infrastructure/drizzle-shop-transaction-effects.js";
import { createRunConnectPayoutTransfersHandler } from "./infrastructure/handlers/scheduler/run-connect-payout-transfers.handler.js";
import {
  createHttpArtCacheInvalidator,
  noopArtCacheInvalidator,
} from "./infrastructure/http-art-cache-invalidator.js";
import { createDrizzleRegisterMediaAssetStore } from "./infrastructure/scheduler/drizzle-register-media-asset.store.js";
import { createSharpImageProbe } from "./infrastructure/sharp-image-probe.js";
import { resolveShopMediaStorage } from "./infrastructure/shop-media-storage.js";
import { createStripePaymentRefundGateway } from "./infrastructure/stripe-payment-refund.gateway.js";
import { createStripeShopCheckoutGateway } from "./infrastructure/stripe-shop-checkout.gateway.js";
import { createStripeShopConnectGateway } from "./infrastructure/stripe-shop-connect.gateway.js";
import { resolveShopMediaPublicUrl } from "./presenters/resolve-shop-media-url.js";
import { createShopScheduler } from "./scheduler/create-shop-scheduler.js";
import type { ShopSchedulerHandle } from "./scheduler/create-shop-scheduler.js";
import type { ShopSchedulerTask } from "./scheduler/shop-scheduler-task.js";
import { createAdminCommandPruneTask } from "./scheduler/tasks/admin-command-prune.task.js";
import { createAlertDigestTask } from "./scheduler/tasks/alert-digest.task.js";
import { createAlertMatchingTask } from "./scheduler/tasks/alert-matching.task.js";
import { createAlertRetentionTask } from "./scheduler/tasks/alert-retention.task.js";
import { createConnectPayoutTransferTask } from "./scheduler/tasks/connect-payout-transfer.task.js";
import { createGuestOrderClaimTask } from "./scheduler/tasks/guest-order-claim.task.js";
import { createIdentityMergeTask } from "./scheduler/tasks/identity-merge.task.js";
import { createLinkedListingSyncTask } from "./scheduler/tasks/linked-listing-sync.task.js";
import { createNotifyMeDispatchTask } from "./scheduler/tasks/notify-me-dispatch.task.js";
import { createPayoutEligibilityTask } from "./scheduler/tasks/payout-eligibility.task.js";
import { createPersonalDataAnonymisationTask } from "./scheduler/tasks/personal-data-anonymisation.task.js";
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
  alertRetention: AlertRetentionStore;
}): ShopSchedulerTask[] {
  const notifications = createDrizzleShopNotificationPublisher();
  const paymentGateway = createStripeShopCheckoutGateway({
    secretKey: input.env.STRIPE_SECRET_KEY,
    storefrontUrl: input.env.SHOP_STOREFRONT_URL,
    fakeCheckoutEnabled: input.env.SHOP_FAKE_CHECKOUT_ENABLED,
  });
  const opsAlertEmail =
    input.env.SHOP_OPS_ALERT_EMAIL ?? input.env.SHOP_ENQUIRY_NOTIFICATION_EMAIL ?? null;
  const mediaStorage = resolveShopMediaStorage(input.env);
  const alerts = createShopAlertRuntime({
    db: input.db,
    env: input.env,
    origins: resolveStorefrontOrigins({
      shopStorefrontUrl: input.env.SHOP_STOREFRONT_URL,
      laxArtPublicUrl: input.env.LAX_ART_PUBLIC_URL,
    }),
    resolveMediaUrl: (value) => resolveShopMediaPublicUrl(mediaStorage?.storage ?? null, value),
    log: {
      info: (fields, message) => input.log.info(fields, message),
      warn: (fields, message) => input.log.warn(fields, message),
    },
  });
  const artCache =
    input.env.ART_REVALIDATE_URL && input.env.ART_REVALIDATE_SECRET
      ? createHttpArtCacheInvalidator({
          url: input.env.ART_REVALIDATE_URL,
          secret: input.env.ART_REVALIDATE_SECRET,
        })
      : noopArtCacheInvalidator;
  return [
    createAlertMatchingTask(alerts.matching),
    createAlertDigestTask({ mode: alerts.mode, runs: alerts.digests }),
    createAlertRetentionTask({
      store: input.alertRetention,
      dryRun: !input.env.ALERT_RETENTION_PURGE_ENABLED,
      log: {
        info: (fields, message) => input.log.info(fields, message),
        error: (fields, message) => input.log.error(fields, message),
      },
    }),
    createStaleCheckoutReaperTask(input.db, paymentGateway),
    createIdentityMergeTask(input.db, opsAlertEmail),
    createGuestOrderClaimTask(input.db, input.env),
    createPersonalDataAnonymisationTask(input.db, input.env),
    createRetainedInvoicePurgeTask(input.db, input.env),
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
    createLinkedListingSyncTask(
      input.db,
      artCache,
      (error) =>
        input.log.warn(
          { err: error },
          "lax.art catalogue refresh failed after a Zoho listing update",
        ),
      mediaStorage
        ? () =>
            registerMissingMediaAssets({
              store: createDrizzleRegisterMediaAssetStore(input.db),
              storage: mediaStorage.storage,
              probe: createSharpImageProbe(),
              onSkipped: (key, reason) =>
                input.log.warn({ key, reason }, "Zoho picture not registered yet"),
            })
        : undefined,
    ),
    ...(input.env.SHOP_THIRD_PARTY_ENABLED
      ? [createStockHoldExpiryTask(input.db, input.env.DOMAIN_EVENT_PUBLISH_VALIDATE)]
      : []),
  ];
}

export function createShopApiScheduler(input: {
  db: Database;
  env: ShopApiEnv;
  log: FastifyBaseLogger;
  alertRetention: AlertRetentionStore;
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
