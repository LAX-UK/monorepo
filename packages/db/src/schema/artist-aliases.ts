import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { artistProfile } from "./artist-profiles.js";
import { user } from "./auth.js";

export const artistAlias = pgTable(
  "artist_alias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistProfileId: uuid("artist_profile_id")
      .notNull()
      .references(() => artistProfile.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    kind: text("kind").notNull().default("synonym"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("artist_alias_profile_alias_uidx").on(table.artistProfileId, table.alias),
    index("artist_alias_alias_trgm_idx").using("gin", sql`${table.alias} gin_trgm_ops`),
  ],
);

export const artistAliasRelations = relations(artistAlias, ({ one }) => ({
  artistProfile: one(artistProfile, {
    fields: [artistAlias.artistProfileId],
    references: [artistProfile.id],
  }),
  createdBy: one(user, {
    fields: [artistAlias.createdByUserId],
    references: [user.id],
  }),
}));
