import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { shopArtist, shopArtwork } from "./shop-commerce.js";

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
]);

export const shopEditorialPlacementSlotEnum = pgEnum("shop_editorial_placement_slot", [
  "home_hero",
  "home_whats_on",
  "home_stories",
  "home_guide",
  "art_hub_spotlight",
  "collector_hub_card",
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
    postcode: text("postcode"),
    openingHours: jsonb("opening_hours"),
    phone: text("phone"),
    email: text("email"),
    mapUrl: text("map_url"),
    coverMediaKey: text("cover_media_key"),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_editorial_venue_slug_uid").on(table.slug)],
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
    summary: text("summary"),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    timesNote: text("times_note"),
    coverMediaKey: text("cover_media_key"),
    featured: boolean("featured").default(false).notNull(),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
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
    coverMediaKey: text("cover_media_key"),
    videoUrl: text("video_url"),
    featured: boolean("featured").default(false).notNull(),
    bodyBlocks: jsonb("body_blocks").default([]).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_editorial_story_slug_uid").on(table.slug)],
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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_editorial_page_slug_uid").on(table.slug)],
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
    identitySubjectId: text("identity_subject_id").notNull(),
    topic: shopGeneralEnquiryTopicEnum("topic").notNull(),
    contextSlug: text("context_slug"),
    message: text("message").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_general_enquiry_subject_idx").on(table.identitySubjectId, table.createdAt),
  ],
);
