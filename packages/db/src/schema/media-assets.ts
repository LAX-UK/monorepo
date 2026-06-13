import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Additive metadata for uploaded images (original object key is the source of truth). */
export const mediaAsset = pgTable("media_asset", {
  key: text("key").primaryKey(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  blurDataURL: text("blur_data_url").notNull(),
  /** Optional pre-generated derivative keys keyed by variant name (e.g. hero_1920). */
  variants: jsonb("variants").$type<Record<string, string>>(),
  processedAt: timestamp("processed_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});
