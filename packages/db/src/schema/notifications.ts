import { relations, sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    lotId: uuid("lot_id").references(() => lot.id, { onDelete: "set null" }),
    read: boolean("read").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_id_idx").on(table.userId),
    index("notification_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("notification_read_idx").on(table.read),
    index("notification_archived_at_idx").on(table.archivedAt),
    check(
      "notification_type_check",
      sql`${table.type} IN (
        'outbid',
        'lot_cancelled',
        'lot_won',
        'lot_lost',
        'lot_ending_soon',
        'watchlist_starting',
        'watchlist_ending_soon',
        'payment_received',
        'payment_due',
        'lot_ended_seller',
        'kyc_resubmission_required',
        'submission_received_for_review',
        'submission_approved',
        'submission_rejected'
      )`,
    ),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
  lot: one(lot, {
    fields: [notification.lotId],
    references: [lot.id],
  }),
}));
