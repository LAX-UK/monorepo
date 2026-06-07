import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const artistKindEnum = pgEnum("artist_kind", [
  // Original taxonomy
  "artist",
  "maker",
  "brand",
  "marque",
  // Fine art / design
  "designer",
  "studio",
  // Manufacturing / automobilia
  "manufacturer",
  "coachbuilder",
  // Books & manuscripts / literature
  "author",
  "publisher",
  "printer",
  // Numismatics
  "mint",
  "issuing_authority",
  // Producer / estate (collectible attributions)
  "producer",
]);

export const artistStatusEnum = pgEnum("artist_status", [
  "pending",
  "approved",
  "rejected",
  "merged_into",
]);

export const artistProfile = pgTable(
  "artist_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull().unique(),
    portraitUrl: text("portrait_url"),
    heroImageUrl: text("hero_image_url"),
    shortBio: text("short_bio"),
    longBio: text("long_bio"),
    statement: text("statement"),
    nationality: text("nationality"),
    location: text("location"),
    /** ISO 3166-1 alpha-2 country code for uniform faceting across kinds (origin country). */
    countryCode: text("country_code"),
    /** Person-kind lifespan (artist, maker, designer, author). */
    birthYear: text("birth_year"),
    deathYear: text("death_year"),
    /** Organisation-kind lifespan (brand, marque, mint, studio, publisher...). */
    foundedYear: text("founded_year"),
    dissolvedYear: text("dissolved_year"),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    /** Kind-specific rich data validated by the creator-kind config registry. */
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    featured: boolean("featured").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    /** Artist registry taxonomy  */
    kind: artistKindEnum("kind").notNull().default("artist"),
    status: artistStatusEnum("status").notNull().default("pending"),
    /** Self-referencing merge target (FK added in migration SQL, not here to avoid circular type ref) */
    mergedIntoArtistId: uuid("merged_into_artist_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),
    /** Legacy: dual-write period with owner_user_id (dropped in 0029) */
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    /** New: legal entity ownership  - FK added in migration to avoid circular import */
    ownerLegalEntityId: uuid("owner_legal_entity_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("artist_profile_archived_idx").on(table.archived),
    index("artist_profile_featured_idx").on(table.featured),
    index("artist_profile_owner_user_id_idx").on(table.ownerUserId),
    index("artist_profile_slug_idx").on(table.slug),
    index("artist_profile_status_idx").on(table.status),
    index("artist_profile_kind_status_idx").on(table.kind, table.status),
    index("artist_profile_country_code_idx").on(table.countryCode),
    index("artist_profile_attributes_gin_idx").using("gin", table.attributes),
    uniqueIndex("artist_profile_merged_into_uidx")
      .on(table.mergedIntoArtistId)
      .where(sql`${table.mergedIntoArtistId} IS NOT NULL`),
    index("artist_profile_owner_legal_entity_id_idx").on(table.ownerLegalEntityId),
    check(
      "artist_profile_merged_into_integrity",
      sql`${table.status} != 'merged_into' OR ${table.mergedIntoArtistId} IS NOT NULL`,
    ),
  ],
);

export const artistProfileRelations = relations(artistProfile, ({ one }) => ({
  ownerUser: one(user, {
    fields: [artistProfile.ownerUserId],
    references: [user.id],
  }),
  // Note: ownerLegalEntity relation deferred to avoid circular import; add in separate relations file if needed
  // Note: mergedInto self-relation omitted to avoid circular type issues; add FK in migration SQL
  createdBy: one(user, {
    fields: [artistProfile.createdByUserId],
    references: [user.id],
  }),
  reviewedBy: one(user, {
    fields: [artistProfile.reviewedByUserId],
    references: [user.id],
  }),
}));
