import type { LegalEntity } from "@auction/branding";
import type { Database } from "@auction/db";
import { createGuestCheckoutRateLimiters } from "./application/enquiry-rate-limit.js";
import { createGuestCheckoutService } from "./application/guest-checkout/guest-checkout.service.js";
import type { CheckoutWriter, OrderReader } from "./application/ports/commerce.ports.js";
import type { FixedWindowCounter } from "./application/ports/fixed-window-counter.js";
import type { ShopNotificationPublisher } from "./application/ports/shop-notification.publisher.js";
import type { GuestCheckoutRoutesDeps } from "./commerce-route-deps.js";
import { createDrizzleGuestCustomerStore } from "./infrastructure/guest-checkout/drizzle-guest-customer.store.js";
import { createDrizzleGuestOrderLinks } from "./infrastructure/guest-checkout/drizzle-guest-order-links.js";
import { createHttpLaxAccountDirectory } from "./infrastructure/guest-checkout/http-lax-account-directory.js";
import type { IdentityMachineClient } from "./infrastructure/identity-machine-client.js";
import type { ShopDomainEventPublisherMode } from "./infrastructure/shop-domain-event-publisher.js";

/** Composes guest checkout: Identity's account check, the guest and lead store, and order links. */
export function createGuestCheckoutDeps(
  db: Database,
  input: {
    identity: IdentityMachineClient;
    checkout: Pick<CheckoutWriter, "createCheckoutOrder">;
    orders: Pick<OrderReader, "getOrder" | "getCustomerProfile">;
    notifications: ShopNotificationPublisher;
    rateLimitCounter: FixedWindowCounter;
    storefrontUrl: string;
    domainEventMode: ShopDomainEventPublisherMode;
    invoiceIssuer: { supplier: LegalEntity; vatNumber: string | null };
  },
): GuestCheckoutRoutesDeps {
  const limiters = createGuestCheckoutRateLimiters(input.rateLimitCounter);
  const links = createDrizzleGuestOrderLinks(db, {
    orders: input.orders,
    notifications: input.notifications,
    storefrontUrl: input.storefrontUrl,
  });
  return {
    service: createGuestCheckoutService({
      accounts: createHttpLaxAccountDirectory(input.identity),
      guests: createDrizzleGuestCustomerStore(db, { domainEventMode: input.domainEventMode }),
      checkout: input.checkout,
      links,
      rateLimiter: limiters.checkout,
    }),
    links,
    linkRateLimiter: limiters.orderLinks,
    getCustomerProfile: (subject) => input.orders.getCustomerProfile(subject),
    invoiceIssuer: input.invoiceIssuer,
  };
}
