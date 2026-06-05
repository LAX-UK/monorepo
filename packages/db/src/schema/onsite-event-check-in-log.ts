import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { onsiteEventRsvp } from "./onsite-event-rsvp.js";

export const onsiteEventCheckInLog = pgTable(
  "onsite_event_check_in_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rsvpId: uuid("rsvp_id").references(() => onsiteEventRsvp.id, { onDelete: "set null" }),
    eventSlug: text("event_slug").notNull(),
    staffUserId: text("staff_user_id").references(() => user.id, { onDelete: "set null" }),
    result: text("result").notNull(),
    rawInputHash: text("raw_input_hash"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("onsite_event_check_in_log_event_slug_idx").on(table.eventSlug, table.createdAt),
    index("onsite_event_check_in_log_rsvp_idx").on(table.rsvpId),
  ],
);

export const onsiteEventCheckInLogRelations = relations(onsiteEventCheckInLog, ({ one }) => ({
  rsvp: one(onsiteEventRsvp, {
    fields: [onsiteEventCheckInLog.rsvpId],
    references: [onsiteEventRsvp.id],
  }),
  staffUser: one(user, {
    fields: [onsiteEventCheckInLog.staffUserId],
    references: [user.id],
  }),
}));
