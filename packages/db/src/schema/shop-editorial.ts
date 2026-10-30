import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { shopArtist, shopArtwork, shopEnquiryStatusEnum } from "./shop-commerce.js";

export const shopEditorialStatusEnum = pgEnum("shop_editorial_status", ["draft", "published"]);

export const shopEditorialExhibitionKindEnum = pgEnum("shop_editorial_exhibition_kind", [
  "exhibition",
  "film",
  "event",
]);

export const shopEditorialStoryKindEnum = pgEnum("shop_editorial_story_kind", [
  "article",
  "film",
  "press",
  "guide",
  "podcast",
]);

/**
 * Display category for stories. An enum rather than a lookup table: the categories come from the
 * lax.art design and drive tab grouping in code, so a new one ships with a deploy either way.
 * Null means "derive from kind" (`defaultEditorialStoryCategory` in `@auction/shop-contracts`).
 */
export const shopEditorialStoryCategoryEnum = pgEnum("shop_editorial_story_category", [
  "article",
  "artist_interview",
  "artist_conversation",
  "studio_visit",
  "film",
  "press",
  "podcast",
  "collecting_guide",
  "exhibition",
]);

export const shopEditorialPlacementSlotEnum = pgEnum("shop_editorial_placement_slot", [
  "home_hero",
  "home_whats_on",
  "home_stories",
  "home_guide",
  "art_hub_spotlight",
  "collector_hub_card",
  "home_promo_bid",
  "home_promo_shop",
  "art_hub_now_on",
  "art_hub_podcast",
  "art_hub_films",
  "art_hub_press",
  "art_hub_feature",
]);

export const shopEditorialPlacementRefKindEnum = pgEnum("shop_editorial_placement_ref_kind", [
  "exhibition",
  "story",
  "page",
  "venue",
  "external",
]);

export const shopGeneralEnquiryTopicEnum = pgEnum("shop_general_enquiry_topic", [
  "general",
  "private_viewing",
  "art_advisory",
  "selling",
  "exhibition",
  /** "Report a problem" from an order page; `context_slug` holds the order reference. */
  "order_problem",
]);

export const shopEditorialVenue = pgTable(
  "shop_editorial_venue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    updatedBy: text("updated_by"),
    name: text("name").notNull(),
    address: text("address"),
    /** Short first address line for cards, which show street and postcode on separate lines. */
    streetLine: text("street_line"),
    city: text("city"),
    postcode: text("postcode"),
    latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }),
    longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }),
    openingHours: jsonb("opening_hours"),
    phone: text("phone"),
    email: text("email"),
    mapUrl: text("map_url"),
    coverMediaKey: text("cover_media_key"),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_editorial_venue_slug_uid").on(table.slug),
    check(
      "shop_editorial_venue_coordinates_chk",
      sql`(${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90) AND (${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180)`,
    ),
  ],
);

export const shopEditorialExhibition = pgTable(
  "shop_editorial_exhibition",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    updatedBy: text("updated_by"),
    kind: shopEditorialExhibitionKindEnum("kind").notNull(),
    venueId: uuid("venue_id").references(() => shopEditorialVenue.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Short type line under the title, e.g. "Selling exhibition". */
    subtitle: text("subtitle"),
    summary: text("summary"),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    timesNote: text("times_note"),
    coverMediaKey: text("cover_media_key"),
    featured: boolean("featured").default(false).notNull(),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    /** One named gallery contact per exhibition; the public contact is omitted without a name. */
    contactName: text("contact_name"),
    contactRole: text("contact_role"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactAvatarMediaKey: text("contact_avatar_media_key"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_editorial_exhibition_slug_uid").on(table.slug)],
);

export const shopEditorialExhibitionArtwork = pgTable(
  "shop_editorial_exhibition_artwork",
  {
    exhibitionId: uuid("exhibition_id")
      .notNull()
      .references(() => shopEditorialExhibition.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.exhibitionId, table.position],
      name: "shop_editorial_exhibition_artwork_pk",
    }),
  ],
);

export const shopEditorialExhibitionArtist = pgTable(
  "shop_editorial_exhibition_artist",
  {
    exhibitionId: uuid("exhibition_id")
      .notNull()
      .references(() => shopEditorialExhibition.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => shopArtist.id, { onDelete: "cascade" }),
    /** Editor-chosen order (0 first); ties fall back to the read model's own order. */
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.exhibitionId, table.artistId],
      name: "shop_editorial_exhibition_artist_pk",
    }),
  ],
);

export const shopEditorialExhibitionMedia = pgTable(
  "shop_editorial_exhibition_media",
  {
    exhibitionId: uuid("exhibition_id")
      .notNull()
      .references(() => shopEditorialExhibition.id, { onDelete: "cascade" }),
    mediaKey: text("media_key").notNull(),
    position: integer("position").notNull(),
    caption: text("caption"),
  },
  (table) => [
    primaryKey({
      columns: [table.exhibitionId, table.position],
      name: "shop_editorial_exhibition_media_pk",
    }),
  ],
);

export const shopEditorialStory = pgTable(
  "shop_editorial_story",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    updatedBy: text("updated_by"),
    kind: shopEditorialStoryKindEnum("kind").notNull(),
    title: text("title").notNull(),
    standfirst: text("standfirst"),
    category: shopEditorialStoryCategoryEnum("category"),
    authorName: text("author_name"),
    /** Editor override; null falls back to `readMinutesEstimate`. */
    readMinutes: integer("read_minutes"),
    /** Recomputed from the body on every save, so lists show a read time without loading bodies. */
    readMinutesEstimate: integer("read_minutes_estimate"),
    /** Free text, e.g. "Collecting guide", so editors can start a series without a deploy. */
    series: text("series"),
    episodeNumber: integer("episode_number"),
    coverMediaKey: text("cover_media_key"),
    videoUrl: text("video_url"),
    audioUrl: text("audio_url"),
    /** Running time of a film or podcast. */
    durationSeconds: integer("duration_seconds"),
    /** Press coverage: the outlet and the original article. */
    publicationName: text("publication_name"),
    externalUrl: text("external_url"),
    featured: boolean("featured").default(false).notNull(),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_editorial_story_slug_uid").on(table.slug),
    check(
      "shop_editorial_story_counts_chk",
      sql`(${table.readMinutes} IS NULL OR ${table.readMinutes} > 0) AND (${table.readMinutesEstimate} IS NULL OR ${table.readMinutesEstimate} > 0) AND (${table.durationSeconds} IS NULL OR ${table.durationSeconds} > 0) AND (${table.episodeNumber} IS NULL OR ${table.episodeNumber} > 0)`,
    ),
  ],
);

export const shopEditorialStoryArtist = pgTable(
  "shop_editorial_story_artist",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => shopEditorialStory.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => shopArtist.id, { onDelete: "cascade" }),
    /** Editor-chosen order (0 first); ties fall back to the read model's own order. */
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.storyId, table.artistId],
      name: "shop_editorial_story_artist_pk",
    }),
  ],
);

export const shopEditorialStoryArtwork = pgTable(
  "shop_editorial_story_artwork",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => shopEditorialStory.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    /** Editor-chosen order (0 first); ties fall back to the read model's own order. */
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.storyId, table.artworkId],
      name: "shop_editorial_story_artwork_pk",
    }),
  ],
);

export const shopEditorialStoryExhibition = pgTable(
  "shop_editorial_story_exhibition",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => shopEditorialStory.id, { onDelete: "cascade" }),
    exhibitionId: uuid("exhibition_id")
      .notNull()
      .references(() => shopEditorialExhibition.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.storyId, table.exhibitionId],
      name: "shop_editorial_story_exhibition_pk",
    }),
  ],
);

export const shopEditorialPage = pgTable(
  "shop_editorial_page",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    updatedBy: text("updated_by"),
    title: text("title").notNull(),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_editorial_page_slug_uid").on(table.slug)],
);

/** Help centre grouping; shown on lax.art in `position` order. */
export const shopHelpCategory = pgTable(
  "shop_help_category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").default(0).notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_help_category_slug_uid").on(table.slug)],
);

/**
 * One question and its answer. A category with articles cannot be deleted (`restrict`), so
 * removing a category is always a deliberate step after its questions are moved or removed.
 */
export const shopHelpArticle = pgTable(
  "shop_help_article",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => shopHelpCategory.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    question: text("question").notNull(),
    answerBlocks: jsonb("answer_blocks").default([]).notNull(),
    /** Plain text of the answer, recomputed on every save, so search can match it without parsing JSON. */
    answerText: text("answer_text").default("").notNull(),
    position: integer("position").default(0).notNull(),
    status: shopEditorialStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_help_article_slug_uid").on(table.slug),
    index("shop_help_article_category_idx").on(table.categoryId, table.position),
  ],
);

export const shopEditorialPlacement = pgTable(
  "shop_editorial_placement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slot: shopEditorialPlacementSlotEnum("slot").notNull(),
    position: integer("position").notNull(),
    refKind: shopEditorialPlacementRefKindEnum("ref_kind").notNull(),
    refId: uuid("ref_id"),
    headline: text("headline"),
    body: text("body"),
    ctaLabel: text("cta_label"),
    mediaKey: text("media_key"),
    linkUrl: text("link_url"),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_editorial_placement_slot_position_uid").on(table.slot, table.position),
  ],
);

export const shopGeneralEnquiry = pgTable(
  "shop_general_enquiry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Null for guest enquiries, which carry `contactEmail` instead. */
    identitySubjectId: text("identity_subject_id"),
    topic: shopGeneralEnquiryTopicEnum("topic").notNull(),
    /** What the sender and staff quote ("E-2041"); the sequence is shared with artwork enquiries. */
    reference: text("reference")
      .default(sql`('E-' || nextval('shop_enquiry_reference_seq')::text)`)
      .notNull(),
    contextSlug: text("context_slug"),
    message: text("message").notNull(),
    phone: text("phone"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    /** Triage state, as on shop_artwork_interest. */
    status: shopEnquiryStatusEnum("status").default("new").notNull(),
    /** Identity subject of the staff member handling it. */
    assigneeSubject: text("assignee_subject"),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    /** Changes with every triage edit; staff pass it back as the optimistic-concurrency version. */
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_general_enquiry_subject_idx").on(table.identitySubjectId, table.createdAt),
    uniqueIndex("shop_general_enquiry_reference_uid").on(table.reference),
    index("shop_general_enquiry_guest_email_idx")
      .on(sql`lower(${table.contactEmail})`)
      .where(sql`${table.identitySubjectId} IS NULL`),
    index("shop_general_enquiry_inbox_idx").on(
      table.status,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    check(
      "shop_general_enquiry_subject_or_contact_ck",
      sql`${table.identitySubjectId} IS NOT NULL OR ${table.contactEmail} IS NOT NULL`,
    ),
    check(
      "shop_general_enquiry_closed_at_ck",
      sql`(${table.status} = 'closed') = (${table.closedAt} IS NOT NULL)`,
    ),
  ],
);
