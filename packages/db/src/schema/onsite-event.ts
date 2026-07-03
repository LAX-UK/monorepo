import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sale } from "./sales.js";

export const onsiteEvent = pgTable(
  "onsite_event",
  {
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
    /** Linked onsite/hybrid sale for advance check-in / paddle express lane. */
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("onsite_event_sale_id_idx").on(table.saleId),
    // A saleroom sale backs at most one onsite event; RSVP/expected-guests lookups
    // assume this 1:1 link and would silently pick an arbitrary match otherwise.
    uniqueIndex("onsite_event_sale_id_unique")
      .on(table.saleId)
      .where(sql`${table.saleId} IS NOT NULL`),
  ],
);

export const onsiteEventRelations = relations(onsiteEvent, ({ one }) => ({
  sale: one(sale, {
    fields: [onsiteEvent.saleId],
    references: [sale.id],
  }),
}));

export type OnsiteEventSegmentOptionRow = {
  value: string;
  label: string;
  helper?: string;
};
