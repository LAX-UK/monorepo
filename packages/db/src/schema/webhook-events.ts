import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    eventKey: text("event_key").notNull().unique(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    claimExpiresAt: timestamp("claim_expires_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("webhook_event_source_idx").on(table.source),
    index("webhook_event_processed_at_idx").on(table.processedAt),
  ],
);
