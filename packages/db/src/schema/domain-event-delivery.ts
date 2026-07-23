import { bigint, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { domainEvent } from "./domain-events.js";

export const domainEventDeliveryStatuses = [
  "pending",
  "processing",
  "succeeded",
  "retryable",
  "dead_lettered",
] as const;

export type DomainEventDeliveryStatus = (typeof domainEventDeliveryStatuses)[number];

/** Per-consumer delivery ledger for async outbound integrations. */
export const domainEventDelivery = pgTable(
  "domain_event_delivery",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    consumer: text("consumer").notNull(),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => domainEvent.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending").$type<DomainEventDeliveryStatus>(),
    attempts: integer("attempts").notNull().default(0),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "date", withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { mode: "date", withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    providerReference: text("provider_reference"),
    /** Redacted/truncated error text safe for operator dashboards. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("domain_event_delivery_consumer_event_id_unique").on(table.consumer, table.eventId),
    index("domain_event_delivery_status_next_retry_idx").on(table.status, table.nextRetryAt),
    index("domain_event_delivery_status_idx").on(table.status),
  ],
);
