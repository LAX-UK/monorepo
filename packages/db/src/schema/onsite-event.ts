import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  venue: text("venue"),
  dressCode: text("dress_code"),
  arrivalNote: text("arrival_note"),
  status: text("status").notNull().default("published"),
  checkInDryRun: boolean("check_in_dry_run").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export type OnsiteEventSegmentOptionRow = {
  value: string;
  label: string;
  helper?: string;
};
