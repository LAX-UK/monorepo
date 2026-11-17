import { TOPICS_BY_PRODUCT } from "@auction/alerts/topics";
import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { alertAnnouncementColumns, defineAlertTables } from "./alert-tables.js";

/**
 * The alert engine's tables for LAX Shop and lax.art: subscribers, topic switches, matches,
 * digests and announcements. shop-api owns them. One table set holds both products' rows, told
 * apart by `product`, so a person can follow artists on lax.art without receiving Shop mail.
 * Accounts are LAX Account subjects; there is no foreign key across the Identity boundary.
 */
const shopAlertTables = defineAlertTables({
  prefix: "shop",
  products: ["shop", "art"],
  topics: [...TOPICS_BY_PRODUCT.shop, ...TOPICS_BY_PRODUCT.art],
  subjectColumn: "identity_subject_id",
  matchItemKeyIndex: true,
});

export const {
  subscriber: shopAlertSubscriber,
  topic: shopAlertTopic,
  match: shopAlertMatch,
  digest: shopAlertDigest,
} = shopAlertTables;

/**
 * The announced-once record, plus what the release-alert send log keeps (design LA-3, L3 and Q10;
 * migration 0405). The counters count `shop.releases` matches only, and are written as each match
 * settles, so the log stays true after the match prune and after a subscriber is removed. Rows
 * from before 0405 keep NULL counters: their counts were not kept.
 */
export const shopAlertAnnouncement = pgTable(
  "shop_alert_announcement",
  {
    ...alertAnnouncementColumns(),
    /** What the work was when it was published; the log lists `shop_release` rows by this. */
    kind: text("kind"),
    /** The LAX Account subject who published the work, written in the publishing transaction. */
    announcedBy: text("announced_by"),
    /** `shop.releases` matches made when the release was expanded. */
    matchedCount: integer("matched_count"),
    /** Matches in a digest that was sent; NULL on rows from before the counts were kept. */
    emailedCount: integer("emailed_count").default(0),
    /** Matches dropped before sending; NULL on rows from before the counts were kept. */
    droppedCount: integer("dropped_count").default(0),
    /** Dropped matches by engine reason code, for example `{"topic_off": 2}`. */
    droppedReasons: jsonb("dropped_reasons")
      .$type<Record<string, number>>()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    check(
      "shop_alert_announcement_kind_check",
      sql`${t.kind} IS NULL OR ${t.kind} IN ('shop_release', 'art_original')`,
    ),
    check(
      "shop_alert_announcement_counts_check",
      sql`coalesce(${t.matchedCount}, 0) >= 0 AND coalesce(${t.emailedCount}, 0) >= 0 AND coalesce(${t.droppedCount}, 0) >= 0`,
    ),
  ],
);
