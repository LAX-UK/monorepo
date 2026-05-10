import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Dedup Stripe webhook deliveries (Connect account updates, payment events, etc.). */
export const processedStripeEvents = pgTable(
  "processed_stripe_events",
  {
    eventId: text("event_id").primaryKey(),
    source: text("source").notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("processed_stripe_events_source_idx").on(table.source, table.processedAt)],
);
