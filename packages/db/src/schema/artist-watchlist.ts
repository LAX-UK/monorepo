import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { artistProfile } from "./artist-profiles.js";
import { user } from "./auth.js";

/** User follows a canonical artist registry entry. Historically the FK pointed
 * at `user.id` (the seller), but the consolidation migration in
 * `0046_artist_consolidation.sql` repointed it at `artist_profile.id` so the
 * watchlist lines up with the curated catalogue. */
export const artistWatchlist = pgTable(
  "artist_watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfile.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    /** Alert criteria: words the lot's medium must contain. Empty criteria alert on every lot. */
    alertMedium: text("alert_medium"),
    /** Alert criteria: the price range worth hearing about. */
    alertPriceMin: numeric("alert_price_min", { precision: 18, scale: 2 }),
    alertPriceMax: numeric("alert_price_max", { precision: 18, scale: 2 }),
    alertUpdatedAt: timestamp("alert_updated_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    unique("artist_watchlist_user_artist_uid").on(table.userId, table.artistId),
    index("artist_watchlist_user_id_idx").on(table.userId),
    index("artist_watchlist_artist_id_idx").on(table.artistId),
    check(
      "artist_watchlist_alert_price_range_check",
      sql`(${table.alertPriceMin} IS NULL OR ${table.alertPriceMin} >= 0)
        AND (${table.alertPriceMax} IS NULL OR ${table.alertPriceMax} >= 0)
        AND (${table.alertPriceMin} IS NULL OR ${table.alertPriceMax} IS NULL OR ${table.alertPriceMin} <= ${table.alertPriceMax})`,
    ),
  ],
);
