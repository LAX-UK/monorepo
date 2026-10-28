import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { shopArtist, shopMediaAsset } from "./shop-commerce.js";

/** Mirrors `ARTIST_APPLICATION_STATUSES` in @auction/shop-domain, which owns the transitions. */
export const shopArtistApplicationStatusEnum = pgEnum("shop_artist_application_status", [
  "draft",
  "submitted",
  "in_review",
  "more_info_needed",
  "accepted",
  "declined",
]);

export const shopArtistApplicationWorkKindEnum = pgEnum("shop_artist_application_work_kind", [
  "original",
  "edition",
]);

/**
 * An artist's application to be represented by the gallery and join the artist portal, written
 * on lax.art by a signed-in LAX Account and reviewed in LAX Admin. Rows are never deleted: a
 * declined application stays as the record behind the six-month wait before applying again.
 */
export const shopArtistApplication = pgTable(
  "shop_artist_application",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** "LAX-AP-10001": what the artist quotes and what the emails show. */
    reference: text("reference")
      .notNull()
      .default(sql`('LAX-AP-' || nextval('shop_artist_application_reference_seq')::text)`),
    applicantSubjectId: text("applicant_subject_id").notNull(),
    status: shopArtistApplicationStatusEnum("status").default("draft").notNull(),
    artistName: text("artist_name"),
    location: text("location"),
    website: text("website"),
    socialLinks: jsonb("social_links").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    shortBio: text("short_bio"),
    statement: text("statement"),
    representation: text("representation"),
    exhibitions: text("exhibitions"),
    consentToContact: boolean("consent_to_contact").default(false).notNull(),
    /** The email the applicant's account had when they sent it; staff reply to this address. */
    contactEmail: text("contact_email"),
    assigneeSubject: text("assignee_subject"),
    /**
     * The latest note from staff the artist can read: the question when more information is
     * needed, or the reason when declined. Earlier notes stay in the event history.
     */
    messageToArtist: text("message_to_artist"),
    /** The artist profile created on acceptance. */
    artistId: uuid("artist_id").references(() => shopArtist.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { mode: "date", withTimezone: true }),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    /** Bumped on every change; sent back as the optimistic-concurrency version. */
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artist_application_reference_uid").on(table.reference),
    // One open application per account: a new one starts only after a decision.
    uniqueIndex("shop_artist_application_open_uid")
      .on(table.applicantSubjectId)
      .where(sql`${table.status} NOT IN ('accepted', 'declined')`),
    index("shop_artist_application_applicant_idx").on(
      table.applicantSubjectId,
      table.createdAt.desc(),
    ),
    index("shop_artist_application_queue_idx")
      .on(table.status, table.submittedAt.desc(), table.id.desc())
      .where(sql`${table.status} <> 'draft'`),
    check(
      "shop_artist_application_decided_ck",
      sql`(${table.status} IN ('accepted', 'declined')) = (${table.decidedAt} IS NOT NULL)`,
    ),
    check(
      "shop_artist_application_submitted_ck",
      sql`${table.status} = 'draft' OR ${table.submittedAt} IS NOT NULL`,
    ),
    check(
      "shop_artist_application_accepted_artist_ck",
      sql`${table.status} <> 'accepted' OR ${table.artistId} IS NOT NULL`,
    ),
  ],
);

/** One work in an application: an uploaded image with what the artist says about it. */
export const shopArtistApplicationWork = pgTable(
  "shop_artist_application_work",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => shopArtistApplication.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    mediaKey: text("media_key")
      .notNull()
      .references(() => shopMediaAsset.key, { onDelete: "restrict" }),
    title: text("title"),
    year: integer("year"),
    medium: text("medium"),
    size: text("size"),
    kind: shopArtistApplicationWorkKindEnum("kind"),
  },
  (table) => [
    uniqueIndex("shop_artist_application_work_position_uid").on(
      table.applicationId,
      table.position,
    ),
    uniqueIndex("shop_artist_application_work_media_uid").on(table.applicationId, table.mediaKey),
    check(
      "shop_artist_application_work_position_ck",
      sql`${table.position} >= 0 AND ${table.position} < 12`,
    ),
  ],
);

/**
 * What happened to an application, newest last: sent, assigned, questions and answers, the
 * decision. Append-only (shop_app may INSERT and SELECT only); staff actions are also audited.
 */
export const shopArtistApplicationEvent = pgTable(
  "shop_artist_application_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => shopArtistApplication.id, { onDelete: "cascade" }),
    /** A domain action (`submit`, `assign`, `request_info`, `accept`…). */
    action: text("action").notNull(),
    actorSubjectId: text("actor_subject_id").notNull(),
    /** The note to the artist, or the reason, when the action carries one. */
    message: text("message"),
    /** The reviewer assigned, for `assign`. */
    assigneeSubject: text("assignee_subject"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_artist_application_event_application_idx").on(table.applicationId, table.createdAt),
  ],
);
