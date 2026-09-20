import type { Database } from "@auction/db";
import {
  createCheckoutOrderHandler,
  createGetBasketHandler,
  createGetOrderHandler,
  createListOrdersHandler,
  createMergeBasketsHandler,
  createRemoveBasketLineHandler,
  createUpsertBasketLineHandler,
} from "./application/handlers/commerce-handlers.js";
import type { PaymentEventProcessor } from "./application/ports/payment-event.processor.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleCommerceRepository } from "./infrastructure/drizzle-commerce.repository.js";
import { createDrizzlePaymentEventProcessor } from "./infrastructure/drizzle-payment-event.processor.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createStripeShopCheckoutGateway } from "./infrastructure/stripe-shop-checkout.gateway.js";
import {
  parseVerifiedCheckoutSessionAsyncPaymentFailed,
  parseVerifiedCheckoutSessionCompleted,
  parseVerifiedCheckoutSessionExpired,
} from "./infrastructure/stripe-webhook-adapters.js";
import { constructStripeWebhookEvent } from "./infrastructure/stripe-webhook-verifier.js";

export function createCommerceServices(
  db: Database,
  env: ShopApiEnv,
): { commerce: CommerceRoutesDeps; stripeWebhook: StripeWebhookDeps } {
  const paymentGateway = createStripeShopCheckoutGateway({
    secretKey: env.STRIPE_SECRET_KEY,
    storefrontUrl: env.SHOP_STOREFRONT_URL,
  });
  const repository = createDrizzleCommerceRepository(db, paymentGateway, {
    storefrontUrl: env.SHOP_STOREFRONT_URL,
  });

  const notifications = createDrizzleShopNotificationPublisher();
  const paymentEvents: PaymentEventProcessor = createDrizzlePaymentEventProcessor(db, {
    notifications,
    storefrontUrl: env.SHOP_STOREFRONT_URL,
  });

  return {
    commerce: {
      getBasket: createGetBasketHandler(repository),
      upsertBasketLine: createUpsertBasketLineHandler(repository),
      removeBasketLine: createRemoveBasketLineHandler(repository),
      mergeBaskets: createMergeBasketsHandler(repository),
      checkoutOrder: createCheckoutOrderHandler(repository),
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
      completeCheckout: paymentEvents.completeCheckout,
      expireCheckout: paymentEvents.expireCheckout,
      failCheckout: paymentEvents.failCheckout,
    },
  };
}
