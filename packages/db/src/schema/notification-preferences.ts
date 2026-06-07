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
    outbidEmail: boolean("outbid_email").notNull().default(false),
    wonEmail: boolean("won_email").notNull().default(true),
    lostEmail: boolean("lost_email").notNull().default(true),
    endingSoonEmail: boolean("ending_soon_email").notNull().default(true),
    watchlistEmail: boolean("watchlist_email").notNull().default(false),
    paymentEmail: boolean("payment_email").notNull().default(true),
    lotEndedSellerEmail: boolean("lot_ended_seller_email").notNull().default(true),
    submissionUpdatesEmail: boolean("submission_updates_email").notNull().default(true),
    submissionUpdatesPush: boolean("submission_updates_push").notNull().default(true),
    outbidWhatsapp: boolean("outbid_whatsapp").notNull().default(false),
    wonWhatsapp: boolean("won_whatsapp").notNull().default(false),
    lostWhatsapp: boolean("lost_whatsapp").notNull().default(false),
    endingSoonWhatsapp: boolean("ending_soon_whatsapp").notNull().default(false),
    watchlistWhatsapp: boolean("watchlist_whatsapp").notNull().default(false),
    paymentWhatsapp: boolean("payment_whatsapp").notNull().default(false),
    lotEndedSellerWhatsapp: boolean("lot_ended_seller_whatsapp").notNull().default(false),
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
