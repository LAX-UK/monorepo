import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Dedup third-party webhook deliveries (Veriff decision/event, etc.). */
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    source: text("source").notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("processed_webhook_events_source_idx").on(table.source, table.processedAt)],
);
