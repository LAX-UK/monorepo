import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const marketingEventOutboxState = [
  "pending",
  "claimed",
  "sent",
  "failed",
  "skipped",
] as const;
export type MarketingEventOutboxState = (typeof marketingEventOutboxState)[number];

export const marketingEventOutbox = pgTable(
  "marketing_event_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: text("event_id").notNull().unique(),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull(),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("marketing_event_outbox_state_created_idx").on(table.state, table.createdAt)],
);
