import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/** User follows a public artist profile (same `user.id` as seller / featured roster). */
export const artistWatchlist = pgTable(
  "artist_watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("artist_watchlist_user_artist_uid").on(table.userId, table.artistId),
    index("artist_watchlist_user_id_idx").on(table.userId),
    index("artist_watchlist_artist_id_idx").on(table.artistId),
  ],
);
