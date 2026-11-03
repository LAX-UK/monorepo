import { TOPICS_BY_PRODUCT } from "@auction/alerts/topics";
import { defineAlertTables } from "./alert-tables.js";
import { user } from "./auth.js";

/**
 * LAX Bid's alert engine tables: subscribers, topic switches, matches, digests and announcements.
 * The Bid API and worker own them; they are in the shared migration runner's grants.
 */
export const {
  subscriber: bidAlertSubscriber,
  topic: bidAlertTopic,
  match: bidAlertMatch,
  digest: bidAlertDigest,
  announcement: bidAlertAnnouncement,
} = defineAlertTables({
  prefix: "bid",
  products: ["bid"],
  topics: TOPICS_BY_PRODUCT.bid,
  subjectColumn: "user_id",
  subjectReference: () => user.id,
});
