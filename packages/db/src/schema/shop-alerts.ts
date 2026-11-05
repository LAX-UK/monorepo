import { TOPICS_BY_PRODUCT } from "@auction/alerts/topics";
import { defineAlertTables } from "./alert-tables.js";

/**
 * The alert engine's tables for LAX Shop and lax.art: subscribers, topic switches, matches,
 * digests and announcements. shop-api owns them. One table set holds both products' rows, told
 * apart by `product`, so a person can follow artists on lax.art without receiving Shop mail.
 * Accounts are LAX Account subjects; there is no foreign key across the Identity boundary.
 */
export const {
  subscriber: shopAlertSubscriber,
  topic: shopAlertTopic,
  match: shopAlertMatch,
  digest: shopAlertDigest,
  announcement: shopAlertAnnouncement,
} = defineAlertTables({
  prefix: "shop",
  products: ["shop", "art"],
  topics: [...TOPICS_BY_PRODUCT.shop, ...TOPICS_BY_PRODUCT.art],
  subjectColumn: "identity_subject_id",
});
