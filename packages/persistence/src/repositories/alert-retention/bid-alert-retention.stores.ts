import type { AlertRetentionStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  bidAlertAnnouncement,
  bidAlertDigest,
  bidAlertMatch,
  bidAlertSubscriber,
  bidAlertTopic,
} from "@auction/db/schema";
import { DrizzleAlertRetentionStore } from "./alert-retention.store.js";
import { DrizzleVisitorSaleAlertRetentionStore } from "./visitor-sale-alert-retention.store.js";

/** Bid's own alert tables, and its email-only new-sale list. Shop's tables are never reached. */
export function createBidAlertRetentionStores(db: Database): AlertRetentionStore[] {
  return [
    new DrizzleAlertRetentionStore("bid", db, {
      subscriber: bidAlertSubscriber,
      topic: bidAlertTopic,
      match: bidAlertMatch,
      digest: bidAlertDigest,
      announcement: bidAlertAnnouncement,
    }),
    new DrizzleVisitorSaleAlertRetentionStore(db),
  ];
}
