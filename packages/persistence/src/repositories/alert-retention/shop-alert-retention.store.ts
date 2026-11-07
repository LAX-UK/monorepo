import type { AlertRetentionStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  shopAlertAnnouncement,
  shopAlertDigest,
  shopAlertMatch,
  shopAlertSubscriber,
  shopAlertTopic,
} from "@auction/db/schema";
import { DrizzleAlertRetentionStore } from "./alert-retention.store.js";

/** LAX Shop's and lax.art's alert tables (one set, told apart by `product`). Bid's are never reached. */
export function createShopAlertRetentionStore(db: Database): AlertRetentionStore {
  return new DrizzleAlertRetentionStore("shop", db, {
    subscriber: shopAlertSubscriber,
    topic: shopAlertTopic,
    match: shopAlertMatch,
    digest: shopAlertDigest,
    announcement: shopAlertAnnouncement,
  });
}
