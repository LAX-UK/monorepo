import type { Database } from "@auction/db";
import {
  createCancelCheckoutOrderHandler,
  createCheckoutOrderHandler,
  createGetBasketHandler,
  createGetOrderHandler,
  createListOrdersHandler,
  createMergeBasketsHandler,
  createRemoveBasketLineHandler,
  createResumeCheckoutOrderHandler,
  createUpsertBasketLineHandler,
} from "./application/handlers/commerce-handlers.js";
import type { PaymentEventProcessor } from "./application/ports/payment-event.processor.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleCommerceRepository } from "./infrastructure/drizzle-commerce.repository.js";
import { createDrizzlePaymentEventProcessor } from "./infrastructure/drizzle-payment-event.processor.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleStripeMoneyWebhookProcessor } from "./infrastructure/drizzle-stripe-money-webhook.processor.js";
import { loadShopVatPolicy } from "./infrastructure/shop-vat-policy.js";
import { createStripePaymentIntentMetadataFetcher } from "./infrastructure/stripe-refund-metadata.js";
import { createStripeShopCheckoutGateway } from "./infrastructure/stripe-shop-checkout.gateway.js";
import {
  parseVerifiedCheckoutSessionAsyncPaymentFailed,
  parseVerifiedCheckoutSessionCompleted,
  parseVerifiedCheckoutSessionExpired,
  parseVerifiedShopCheckoutCurrencyViolation,
} from "./infrastructure/stripe-webhook-adapters.js";
import { dispatchStripeWebhookEvent } from "./infrastructure/stripe-webhook-registry.js";
import { constructStripeWebhookEvent } from "./infrastructure/stripe-webhook-verifier.js";

export function createCommerceServices(
  db: Database,
  env: ShopApiEnv,
): { commerce: CommerceRoutesDeps; stripeWebhook: StripeWebhookDeps } {
  const paymentGateway = createStripeShopCheckoutGateway({
    secretKey: env.STRIPE_SECRET_KEY,
    storefrontUrl: env.SHOP_STOREFRONT_URL,
    fakeCheckoutEnabled: env.SHOP_FAKE_CHECKOUT_ENABLED,
  });
  const domainEventMode = env.DOMAIN_EVENT_PUBLISH_VALIDATE;
  const repository = createDrizzleCommerceRepository(db, paymentGateway, {
    storefrontUrl: env.SHOP_STOREFRONT_URL,
    domainEventMode,
    vatPolicy: loadShopVatPolicy(env),
    merchandiseEnabled: env.SHOP_MERCHANDISE_ENABLED,
  });

  const notifications = createDrizzleShopNotificationPublisher();
  const opsAlertEmail = env.SHOP_OPS_ALERT_EMAIL ?? env.SHOP_ENQUIRY_NOTIFICATION_EMAIL ?? null;
  const paymentEvents: PaymentEventProcessor = createDrizzlePaymentEventProcessor(db, {
    notifications,
    opsAlertEmail,
    storefrontUrl: env.SHOP_STOREFRONT_URL,
    paymentGateway,
    domainEventMode,
  });

  const fetchPaymentIntentMetadata = createStripePaymentIntentMetadataFetcher({
    secretKey: env.STRIPE_SECRET_KEY,
  });
  const moneyWebhook = createDrizzleStripeMoneyWebhookProcessor(db, {
    domainEventMode,
    notifications,
    opsAlertEmail,
    ...(fetchPaymentIntentMetadata ? { fetchPaymentIntentMetadata } : {}),
  });

  return {
    commerce: {
      merchandiseEnabled: env.SHOP_MERCHANDISE_ENABLED,
      getBasket: createGetBasketHandler(repository),
      upsertBasketLine: createUpsertBasketLineHandler(repository),
      removeBasketLine: createRemoveBasketLineHandler(repository),
      mergeBaskets: createMergeBasketsHandler(repository),
      checkoutOrder: createCheckoutOrderHandler(repository),
      resumeCheckoutOrder: createResumeCheckoutOrderHandler(repository),
      cancelCheckoutOrder: createCancelCheckoutOrderHandler(repository),
      listOrders: createListOrdersHandler(repository),
      getOrder: createGetOrderHandler(repository),
    },
    stripeWebhook: {
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      verifyWebhook: (rawBody, signature) => {
        if (!env.STRIPE_WEBHOOK_SECRET) {
          throw new Error("Webhook not configured");
        }
        return constructStripeWebhookEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
      },
      parseCheckoutSessionCompleted: parseVerifiedCheckoutSessionCompleted,
      parseCheckoutSessionExpired: parseVerifiedCheckoutSessionExpired,
      parseCheckoutSessionAsyncPaymentFailed: parseVerifiedCheckoutSessionAsyncPaymentFailed,
      parseShopCheckoutCurrencyViolation: parseVerifiedShopCheckoutCurrencyViolation,
      completeCheckout: paymentEvents.completeCheckout,
      expireCheckout: paymentEvents.expireCheckout,
      failCheckout: paymentEvents.failCheckout,
      recordCurrencyViolation: paymentEvents.recordCurrencyViolation,
      dispatchWebhook: (event) =>
        dispatchStripeWebhookEvent(event as Parameters<typeof dispatchStripeWebhookEvent>[0], {
          checkout: paymentEvents,
          money: moneyWebhook,
        }),
    },
  };
}
