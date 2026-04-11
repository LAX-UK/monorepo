import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { auction } from "./auctions.js";

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auction.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("watchlist_user_auction_uid").on(table.userId, table.auctionId),
    index("watchlist_user_id_idx").on(table.userId),
  ],
);

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(user, {
    fields: [watchlist.userId],
    references: [user.id],
  }),
  auction: one(auction, {
    fields: [watchlist.auctionId],
    references: [auction.id],
  }),
}));
