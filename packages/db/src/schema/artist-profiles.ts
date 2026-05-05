import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

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
    birthYear: text("birth_year"),
    deathYear: text("death_year"),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    featured: boolean("featured").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("artist_profile_archived_idx").on(table.archived),
    index("artist_profile_featured_idx").on(table.featured),
    index("artist_profile_owner_user_id_idx").on(table.ownerUserId),
    index("artist_profile_slug_idx").on(table.slug),
  ],
);
