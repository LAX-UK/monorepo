import { legalEntityFor } from "@auction/branding";
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
import {
  createListSavedDeliveryAddressesHandler,
  createSaveDeliveryAddressHandler,
} from "./application/handlers/delivery-address-book.handler.js";
import type { FixedWindowCounter } from "./application/ports/fixed-window-counter.js";
import type { PaymentEventProcessor } from "./application/ports/payment-event.processor.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import { createGuestCheckoutDeps } from "./create-guest-checkout-deps.js";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleCommerceRepository } from "./infrastructure/drizzle-commerce.repository.js";
import { createDrizzlePaymentEventProcessor } from "./infrastructure/drizzle-payment-event.processor.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleStripeMoneyWebhookProcessor } from "./infrastructure/drizzle-stripe-money-webhook.processor.js";
import { createHttpIdentityAddressBook } from "./infrastructure/http-identity-address-book.js";
import { createIdentityMachineClient } from "./infrastructure/identity-machine-client.js";
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
  options: { rateLimitCounter: FixedWindowCounter },
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
    editionOrderLimit: env.SHOP_EDITION_ORDER_LIMIT,
  });

  // Identity shares one machine client across products. Without it checkout asks for entry
  // only, and guest checkout is off: no one continues as a guest without the account check.
  const identityConfig =
    env.IDENTITY_MACHINE_CLIENT_ID && env.IDENTITY_MACHINE_CLIENT_SECRET
      ? {
          issuerBaseUrl: env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL,
          clientId: env.IDENTITY_MACHINE_CLIENT_ID,
          clientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
        }
      : null;
  const addressBook = identityConfig ? createHttpIdentityAddressBook(identityConfig) : null;

  const notifications = createDrizzleShopNotificationPublisher();
  const invoiceIssuer = {
    supplier: legalEntityFor("shop"),
    vatNumber: env.SHOP_VAT_REGISTRATION_NUMBER ?? legalEntityFor("shop").vatNumber ?? null,
  };
  const guestCheckout = identityConfig
    ? createGuestCheckoutDeps(db, {
        identity: createIdentityMachineClient(identityConfig),
        checkout: repository,
        orders: repository,
        notifications,
        rateLimitCounter: options.rateLimitCounter,
        storefrontUrl: env.SHOP_STOREFRONT_URL,
        domainEventMode,
        invoiceIssuer,
      })
    : undefined;
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
      editionOrderLimit: env.SHOP_EDITION_ORDER_LIMIT,
      getBasket: createGetBasketHandler(repository),
      upsertBasketLine: createUpsertBasketLineHandler(repository),
      removeBasketLine: createRemoveBasketLineHandler(repository),
      mergeBaskets: createMergeBasketsHandler(repository),
      checkoutOrder: createCheckoutOrderHandler(repository),
      resumeCheckoutOrder: createResumeCheckoutOrderHandler(repository),
      cancelCheckoutOrder: createCancelCheckoutOrderHandler(repository),
      listOrders: createListOrdersHandler(repository),
      getOrder: createGetOrderHandler(repository),
      getCustomerProfile: (subject) => repository.getCustomerProfile(subject),
      invoiceIssuer,
      ...(guestCheckout ? { guestCheckout } : {}),
      savedAddresses: {
        list: createListSavedDeliveryAddressesHandler(addressBook),
        save: createSaveDeliveryAddressHandler(addressBook),
      },
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
