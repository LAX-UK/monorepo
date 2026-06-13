import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const notificationOutboxState = ["pending", "claimed", "sent", "failed"] as const;
export type NotificationOutboxState = (typeof notificationOutboxState)[number];

/** Durable queue for critical bid/lot-close user notifications (outbid, won, lost). */
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("notification_outbox_state_created_idx").on(table.state, table.createdAt),
    index("notification_outbox_user_id_idx").on(table.userId),
  ],
);
