import type { Database } from "@auction/db";
import { shopReleaseAlertSubscription as subscription } from "@auction/db/schema";
import { asc, eq } from "drizzle-orm";
import type { ReleaseAlertAnnouncer } from "../application/ports/release-alert.store.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { type StorefrontOrigins, artworkPublicUrl } from "../domain/storefront-origins.js";
import { releaseAlertUnsubscribeUrl } from "./release-alert-links.js";

/**
 * Emails the confirmed list about a published edition through the shop's email outbox. The
 * idempotency key is per edition and subscriber, so publishing the same edition again (after
 * unpublishing it, say) never emails anyone twice.
 */
export function createDrizzleReleaseAlertAnnouncer(deps: {
  notifications: ShopNotificationPublisher;
  storefrontOrigins: StorefrontOrigins;
}): ReleaseAlertAnnouncer {
  const { notifications, storefrontOrigins } = deps;
  return {
    async announce(tx, edition) {
      const db = tx as Database;
      const recipients = await db
        .select({
          id: subscription.id,
          email: subscription.email,
          unsubscribeToken: subscription.unsubscribeToken,
        })
        .from(subscription)
        .where(eq(subscription.status, "confirmed"))
        .orderBy(asc(subscription.id));

      const artworkUrl = artworkPublicUrl(storefrontOrigins, "shop", edition.slug);
      for (const recipient of recipients) {
        await notifications.queueReleaseAlert(tx, {
          idempotencyKey: `release-alert:${edition.artworkId}:${recipient.id}`,
          to: recipient.email,
          artworkTitle: edition.title,
          artistName: edition.artistName,
          artworkUrl,
          unsubscribeUrl: releaseAlertUnsubscribeUrl(
            storefrontOrigins.shop,
            recipient.unsubscribeToken,
          ),
        });
      }
      return { queued: recipients.length };
    },
  };
}
