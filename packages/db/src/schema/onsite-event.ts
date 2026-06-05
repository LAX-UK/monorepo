import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const onsiteEvent = pgTable("onsite_event", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
  rsvpCloseAt: timestamp("rsvp_close_at", { mode: "date", withTimezone: true }),
  segmentOptions: jsonb("segment_options")
    .$type<OnsiteEventSegmentOptionRow[]>()
    .notNull()
    .default([]),
  opsEmail: text("ops_email"),
  micrositeUrl: text("microsite_url"),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export type OnsiteEventSegmentOptionRow = {
  value: string;
  label: string;
  helper?: string;
};
