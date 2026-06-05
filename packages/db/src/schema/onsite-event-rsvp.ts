import { relations } from "drizzle-orm";
import { index, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { onsiteEvent } from "./onsite-event.js";

export const onsiteEventRsvp = pgTable(
  "onsite_event_rsvp",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventSlug: text("event_slug")
      .notNull()
      .references(() => onsiteEvent.slug, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attendanceSegment: text("attendance_segment").notNull(),
    plusOne: smallint("plus_one").notNull().default(0),
    plusOneGuestName: text("plus_one_guest_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("onsite_event_rsvp_event_user_uq").on(table.eventSlug, table.userId),
    index("onsite_event_rsvp_event_slug_idx").on(table.eventSlug),
    index("onsite_event_rsvp_user_idx").on(table.userId),
  ],
);

export const onsiteEventRsvpRelations = relations(onsiteEventRsvp, ({ one }) => ({
  user: one(user, {
    fields: [onsiteEventRsvp.userId],
    references: [user.id],
  }),
  event: one(onsiteEvent, {
    fields: [onsiteEventRsvp.eventSlug],
    references: [onsiteEvent.slug],
  }),
}));
