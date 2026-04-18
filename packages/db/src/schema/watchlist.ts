import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("watchlist_user_lot_uid").on(table.userId, table.lotId),
    index("watchlist_user_id_idx").on(table.userId),
  ],
);

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(user, {
    fields: [watchlist.userId],
    references: [user.id],
  }),
  lot: one(lot, {
    fields: [watchlist.lotId],
    references: [lot.id],
  }),
}));
