import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AlertProduct, AlertStatusTuple } from "./alert-tables.types.js";

export type AlertTablesConfig = {
  /** `bid` or `shop`: names the tables `<prefix>_alert_*` and the indexes on them. */
  prefix: string;
  /** The products that may appear in `product` (Shop's tables also hold lax.art). */
  products: readonly AlertProduct[];
  /** The topics the product offers: the only values `topic` may hold. */
  topics: readonly string[];
  /** The account column: `user_id` on Bid, `identity_subject_id` on Shop. */
  subjectColumn: string;
  /** Where the account column points, when it has a foreign key (Bid's `user.id`). */
  subjectReference?: () => AnyPgColumn;
};

const STATUSES: AlertStatusTuple = ["pending", "confirmed", "stopped"];
const STOP_REASONS = ["link", "one_click", "settings", "complaint", "staff", "erasure"] as const;

const list = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));
const ts = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

/**
 * The five tables every product's alerts use, in one shape: subscribers, one row per topic switch,
 * the match ledger, the one-digest-a-day ledger, and the announced-once record. Bid and Shop each
 * call this once, so the engine's store contract holds for both and a review covers one shape.
 */
export function defineAlertTables(config: AlertTablesConfig) {
  const { prefix } = config;

  const subscriber = pgTable(
    `${prefix}_alert_subscriber`,
    {
      id: uuid("id").defaultRandom().primaryKey(),
      product: text("product").notNull(),
      /** Lower-cased and trimmed. */
      email: text("email").notNull(),
      subjectId: (() => {
        const column = text(config.subjectColumn);
        return config.subjectReference
          ? column.references(config.subjectReference, { onDelete: "set null" })
          : column;
      })(),
      status: text("status").notNull().default("pending"),
      /** The wording shown beside the form at the time of the request: proof of consent. */
      consentText: text("consent_text").notNull(),
      /** Where the request came from, for example `web_home_alerts`. */
      consentSource: text("consent_source").notNull(),
      /** When the current confirmation was requested; a confirm link names this instant. */
      requestedAt: ts("requested_at").notNull(),
      confirmationSentAt: ts("confirmation_sent_at"),
      confirmedAt: ts("confirmed_at"),
      stoppedAt: ts("stopped_at"),
      stopReason: text("stop_reason"),
      /** Bumped to revoke every link already sent. */
      linkVersion: integer("link_version").notNull().default(1),
      /** A hash of the stop token a pre-engine list sent, so its old links keep resolving. */
      legacyLinkHash: text("legacy_link_hash"),
      createdAt: ts("created_at").notNull().defaultNow(),
      updatedAt: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
      uniqueIndex(`${prefix}_alert_subscriber_product_email_uid`).on(t.product, t.email),
      index(`${prefix}_alert_subscriber_subject_idx`).on(t.subjectId),
      index(`${prefix}_alert_subscriber_status_idx`).on(t.status),
      check(
        `${prefix}_alert_subscriber_product_check`,
        sql`${t.product} IN (${list(config.products)})`,
      ),
      check(`${prefix}_alert_subscriber_status_check`, sql`${t.status} IN (${list(STATUSES)})`),
      check(
        `${prefix}_alert_subscriber_stop_reason_check`,
        sql`${t.stopReason} IS NULL OR ${t.stopReason} IN (${list(STOP_REASONS)})`,
      ),
      check(
        `${prefix}_alert_subscriber_email_normalised`,
        sql`${t.email} = lower(btrim(${t.email}))`,
      ),
    ],
  );

  const topic = pgTable(
    `${prefix}_alert_topic`,
    {
      subscriberId: uuid("subscriber_id")
        .notNull()
        .references(() => subscriber.id, { onDelete: "cascade" }),
      topic: text("topic").notNull(),
      emailOn: boolean("email_on").notNull().default(false),
      changedAt: ts("changed_at").notNull().defaultNow(),
      changedBy: text("changed_by").notNull().default("person"),
    },
    (t) => [
      primaryKey({ columns: [t.subscriberId, t.topic] }),
      index(`${prefix}_alert_topic_email_idx`).on(t.topic, t.subscriberId).where(sql`${t.emailOn}`),
      check(`${prefix}_alert_topic_topic_check`, sql`${t.topic} IN (${list(config.topics)})`),
      check(
        `${prefix}_alert_topic_changed_by_check`,
        sql`${t.changedBy} IN ('person', 'migration', 'staff')`,
      ),
    ],
  );

  const digest = pgTable(
    `${prefix}_alert_digest`,
    {
      id: uuid("id").defaultRandom().primaryKey(),
      subscriberId: uuid("subscriber_id")
        .notNull()
        .references(() => subscriber.id, { onDelete: "cascade" }),
      product: text("product").notNull(),
      /** The London calendar day the digest is for. */
      localDate: date("local_date", { mode: "string" }).notNull(),
      itemCount: integer("item_count").notNull(),
      outboxIdempotencyKey: text("outbox_idempotency_key").notNull(),
      /** Set once the email is on the outbox; empty means an interrupted run must send it again. */
      sentAt: ts("sent_at"),
      createdAt: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
      // The frequency cap: one digest per person, product and London day.
      uniqueIndex(`${prefix}_alert_digest_cap_uid`).on(t.subscriberId, t.product, t.localDate),
      index(`${prefix}_alert_digest_unsent_idx`)
        .on(t.product, t.localDate)
        .where(sql`${t.sentAt} IS NULL`),
    ],
  );

  const match = pgTable(
    `${prefix}_alert_match`,
    {
      id: uuid("id").defaultRandom().primaryKey(),
      subscriberId: uuid("subscriber_id")
        .notNull()
        .references(() => subscriber.id, { onDelete: "cascade" }),
      topic: text("topic").notNull(),
      /** `sale:<id>`, `lot:<id>`, `artwork:<id>`. */
      itemKey: text("item_key").notNull(),
      /** The artist or saved search a match belongs to, for grouping. */
      groupKey: text("group_key"),
      /** What the email shows about the item, kept so it can be built later. */
      snapshot: jsonb("snapshot").notNull(),
      matchedAt: ts("matched_at").notNull().defaultNow(),
      /** Empty until the match is attached to a digest. */
      digestId: uuid("digest_id").references(() => digest.id, { onDelete: "set null" }),
      droppedReason: text("dropped_reason"),
    },
    (t) => [
      uniqueIndex(`${prefix}_alert_match_item_uid`).on(t.subscriberId, t.topic, t.itemKey),
      index(`${prefix}_alert_match_pending_idx`)
        .on(t.subscriberId)
        .where(sql`${t.digestId} IS NULL AND ${t.droppedReason} IS NULL`),
      index(`${prefix}_alert_match_digest_idx`).on(t.digestId),
      check(`${prefix}_alert_match_topic_check`, sql`${t.topic} IN (${list(config.topics)})`),
    ],
  );

  const announcement = pgTable(`${prefix}_alert_announcement`, {
    itemKey: text("item_key").primaryKey(),
    announcedAt: ts("announced_at").notNull().defaultNow(),
    /** False when staff unticked "Announce": the item counts as announced and tells nobody. */
    announce: boolean("announce").notNull(),
    /** When the item was turned into matches. */
    expandedAt: ts("expanded_at"),
  });

  return { subscriber, topic, match, digest, announcement };
}

export type AlertTables = ReturnType<typeof defineAlertTables>;
