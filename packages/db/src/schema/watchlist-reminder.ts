import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";
import { watchlist } from "./watchlist.js";

/**
 * A reminder on a watched lot: when (as the sale starts, a day or an hour before the lot closes)
 * and an optional note. One per watched lot, removed with it. `sent_at` is set once it is sent
 * (or dropped because its moment passed); changing the reminder clears it.
 */
export const watchlistReminder = pgTable(
  "watchlist_reminder",
  {
    watchlistId: uuid("watchlist_id")
      .primaryKey()
      .references(() => watchlist.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    note: text("note"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "watchlist_reminder_kind_check",
      sql`${table.kind} IN ('sale_start', 'day_before_close', 'hour_before_close')`,
    ),
    check("watchlist_reminder_note_length", sql`char_length(${table.note}) <= 500`),
    index("watchlist_reminder_user_idx").on(table.userId),
    index("watchlist_reminder_pending_idx").on(table.lotId).where(sql`${table.sentAt} IS NULL`),
  ],
);
