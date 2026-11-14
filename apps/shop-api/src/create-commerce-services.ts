import type { MoneyPauseReader } from "@auction/artwork-register-contracts";
import { legalEntityFor } from "@auction/branding";
import type { Database } from "@auction/db";
import { createDeliveryQuoteAcceptanceService } from "./application/delivery-quote-acceptance/delivery-quote-acceptance.service.js";
import { createDeliveryQuoteRequestService } from "./application/delivery-quote-request/delivery-quote-request.service.js";
import { guardAgainstPendingDeletion } from "./application/guard-against-pending-deletion.js";
import {
  createCancelCheckoutOrderHandler,
  createCheckoutOrderHandler,
  createGetBasketHandler,
  createGetOrderHandler,
  createListOrdersHandler,
  createMergeBasketsHandler,
  createRemoveBasketLineHandler,
  createResumeCheckoutOrderHandler,
  createSetBasketLineFramingHandler,
  createUpsertBasketLineHandler,
} from "./application/handlers/commerce-handlers.js";
import {
  createListSavedDeliveryAddressesHandler,
  createSaveDeliveryAddressHandler,
} from "./application/handlers/delivery-address-book.handler.js";
import { createOrderInvoiceCardService } from "./application/order-invoice-card.js";
import type { FixedWindowCounter } from "./application/ports/fixed-window-counter.js";
import type { InvoiceCopyStorage } from "./application/ports/order-invoice-books.port.js";
import type { PaymentEventProcessor } from "./application/ports/payment-event.processor.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import { createGuestCheckoutDeps } from "./create-guest-checkout-deps.js";
import type { ShopApiEnv } from "./env.js";
import { readDeliveryRegions } from "./infrastructure/delivery-regions/drizzle-delivery-regions.store.js";
import { createDrizzleCheckoutMoneyPause } from "./infrastructure/drizzle-checkout-money-pause.js";
import { createDrizzleCommerceRepository } from "./infrastructure/drizzle-commerce.repository.js";
import { createDrizzleDeliveryQuoteAcceptanceStore } from "./infrastructure/drizzle-delivery-quote-acceptance.store.js";
import { createDrizzleDeliveryQuoteOrderStore } from "./infrastructure/drizzle-delivery-quote-order.store.js";
import { createDrizzleOrderInvoiceBooksReader } from "./infrastructure/drizzle-order-invoice-books.reader.js";
import { createDrizzlePaymentEventProcessor } from "./infrastructure/drizzle-payment-event.processor.js";
import { createDrizzlePendingDeletionReader } from "./infrastructure/drizzle-pending-deletion.reader.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleStripeMoneyWebhookProcessor } from "./infrastructure/drizzle-stripe-money-webhook.processor.js";
import { createHttpIdentityAddressBook } from "./infrastructure/http-identity-address-book.js";
import { createIdentityMachineClient } from "./infrastructure/identity-machine-client.js";
import type { UnappliedMoneyLookup } from "./infrastructure/shop-unapplied-payment.js";
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

import type { OriginalOfferRegister } from "./application/ports/original-offer-register.js";

export function createCommerceServices(
  db: Database,
  env: ShopApiEnv,
  options: {
    rateLimitCounter: FixedWindowCounter;
    originalOffers: OriginalOfferRegister;
    /** The finance task store: money that arrives for a closed order is recorded there. */
    unappliedMoney: UnappliedMoneyLookup;
    /** Whether new money for an artwork is paused while Zoho says it is sold. */
    moneyPause: MoneyPauseReader;
    /** LAX's document storage (stored copies of Books invoices); null where not configured. */
    invoiceCopies?: InvoiceCopyStorage | null;
  },
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
    exportPaymentEnabled: env.SHOP_EXPORT_PAYMENT_ENABLED,
    framingEnabled: env.SHOP_FRAMING_ENABLED,
    editionOrderLimit: env.SHOP_EDITION_ORDER_LIMIT,
    moneyPause: createDrizzleCheckoutMoneyPause(db, options.moneyPause),
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

  const pendingDeletion = createDrizzlePendingDeletionReader(db);
  const notifications = createDrizzleShopNotificationPublisher();
  const invoiceIssuer = {
    supplier: legalEntityFor("shop"),
    vatNumber: env.SHOP_VAT_REGISTRATION_NUMBER ?? legalEntityFor("shop").vatNumber ?? null,
  };
  const quoteRequests = createDeliveryQuoteRequestService({
    regions: { read: () => readDeliveryRegions(db) },
    orders: createDrizzleDeliveryQuoteOrderStore(db, {
      framingEnabled: env.SHOP_FRAMING_ENABLED,
      domainEventMode,
      vatPolicy: loadShopVatPolicy(env),
      merchandiseEnabled: env.SHOP_MERCHANDISE_ENABLED,
      notifications,
    }),
    checkout: repository,
    exportPaymentEnabled: env.SHOP_EXPORT_PAYMENT_ENABLED,
    guestHoldWorkingDays: env.SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS,
  });
  const quoteAcceptance = createDeliveryQuoteAcceptanceService({
    store: createDrizzleDeliveryQuoteAcceptanceStore(db, { vatPolicy: loadShopVatPolicy(env) }),
    checkout: repository,
    exportPaymentEnabled: env.SHOP_EXPORT_PAYMENT_ENABLED,
  });
  const guestCheckout = identityConfig
    ? createGuestCheckoutDeps(db, {
        identity: createIdentityMachineClient(identityConfig),
        checkout: repository,
        quotes: quoteRequests,
        acceptance: quoteAcceptance,
        orders: repository,
        notifications,
        paymentGateway,
        rateLimitCounter: options.rateLimitCounter,
        storefrontUrl: env.SHOP_STOREFRONT_URL,
        domainEventMode,
        ipHashSecret: env.SHOP_API_BFF_TOKEN ?? "shop-guest-hold-development-secret",
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
    unappliedMoney: options.unappliedMoney,
    moneyPause: createDrizzleCheckoutMoneyPause(db, options.moneyPause),
  });

  const fetchPaymentIntentMetadata = createStripePaymentIntentMetadataFetcher({
    secretKey: env.STRIPE_SECRET_KEY,
  });
  const moneyWebhook = createDrizzleStripeMoneyWebhookProcessor(db, {
    domainEventMode,
    offers: options.originalOffers,
    notifications,
    opsAlertEmail,
    ...(fetchPaymentIntentMetadata ? { fetchPaymentIntentMetadata } : {}),
  });

  return {
    commerce: {
      merchandiseEnabled: env.SHOP_MERCHANDISE_ENABLED,
      framingEnabled: env.SHOP_FRAMING_ENABLED,
      editionOrderLimit: env.SHOP_EDITION_ORDER_LIMIT,
      getBasket: createGetBasketHandler(repository),
      upsertBasketLine: createUpsertBasketLineHandler(repository),
      removeBasketLine: createRemoveBasketLineHandler(repository),
      setBasketLineFraming: createSetBasketLineFramingHandler(repository),
      mergeBaskets: createMergeBasketsHandler(repository),
      checkoutOrder: guardAgainstPendingDeletion(
        pendingDeletion,
        createCheckoutOrderHandler(repository),
      ),
      resumeCheckoutOrder: guardAgainstPendingDeletion(
        pendingDeletion,
        createResumeCheckoutOrderHandler(repository),
      ),
      cancelCheckoutOrder: createCancelCheckoutOrderHandler(repository),
      acceptDeliveryQuote: guardAgainstPendingDeletion(pendingDeletion, (input) =>
        quoteAcceptance.acceptAndPay(input),
      ),
      requestDeliveryQuote: guardAgainstPendingDeletion(pendingDeletion, (input) =>
        quoteRequests.request(input),
      ),
      listOrders: createListOrdersHandler(repository),
      getOrder: createGetOrderHandler(repository),
      getCustomerProfile: (subject) => repository.getCustomerProfile(subject),
      invoiceIssuer,
      orderInvoiceCard: createOrderInvoiceCardService({
        books: createDrizzleOrderInvoiceBooksReader(db),
        storage: options.invoiceCopies ?? null,
        now: () => new Date(),
      }),
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
