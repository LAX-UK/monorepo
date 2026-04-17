import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    outbidInApp: boolean("outbid_in_app").notNull().default(true),
    wonInApp: boolean("won_in_app").notNull().default(true),
    lostInApp: boolean("lost_in_app").notNull().default(true),
    endingSoonInApp: boolean("ending_soon_in_app").notNull().default(true),
    watchlistInApp: boolean("watchlist_in_app").notNull().default(true),
    paymentInApp: boolean("payment_in_app").notNull().default(true),
    outbidPush: boolean("outbid_push").notNull().default(true),
    wonPush: boolean("won_push").notNull().default(true),
    endingSoonPush: boolean("ending_soon_push").notNull().default(false),
    quietStart: text("quiet_start"),
    quietEnd: text("quiet_end"),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notification_preference_user_id_idx").on(table.userId)],
);

export const notificationPreferenceRelations = relations(notificationPreference, ({ one }) => ({
  user: one(user, {
    fields: [notificationPreference.userId],
    references: [user.id],
  }),
}));
