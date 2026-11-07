import type { SubscriptionConfirmedHook } from "@auction/alerts";
import type { Database } from "@auction/db";
import { emailHash } from "@auction/email";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

/**
 * The "subscription became confirmed" step for LAX Shop and lax.art, shared by the confirm link and
 * by a signed-in account switching alerts on. shop_app cannot touch the mail suppression list, so
 * it records the fact as a domain event (the address hash, never the address) and the worker's
 * `zoho_campaigns_opt_out_lift` consumer lifts any old Zoho Campaigns marketing opt-out with its
 * own rights. A failure reaches the caller, so a retried confirm link writes the event again.
 */
export function publishAlertConfirmed(
  db: Database,
  mode: ShopDomainEventPublisherMode,
): SubscriptionConfirmedHook {
  const events = createShopDomainEventPublisher(mode);
  return async ({ subscriberId, product, email, at }) => {
    await events.insertInTransaction(db, {
      aggregateType: "alert_subscriber",
      aggregateId: subscriberId,
      eventType: "alert.subscription.confirmed",
      payload: {
        schemaVersion: 1,
        emailHash: emailHash(email),
        product,
        confirmedAt: at.toISOString(),
      },
      producer: "shop-api",
    });
  };
}
