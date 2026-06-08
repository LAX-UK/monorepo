import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const domainEvent = pgTable(
  "domain_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    producer: text("producer").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    /** acting legal entity context at event time (nullable; not a FK since entity may be archived) */
    actingLegalEntityId: text("acting_legal_entity_id"),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    schemaVersion: integer("schema_version").notNull().default(1),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("domain_events_event_type_idx").on(table.eventType),
    index("domain_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("domain_events_occurred_at_idx").on(table.occurredAt),
    index("domain_events_acting_legal_entity_idx").on(table.actingLegalEntityId, table.occurredAt),
    // Hard idempotency guard: at most one `user.email_verified` per user. The magic-link
    // verify hook fires on every passwordless sign-in, so this collapses concurrent inserts.
    uniqueIndex("domain_events_user_email_verified_uid")
      .on(table.aggregateType, table.aggregateId)
      .where(sql`${table.eventType} = 'user.email_verified'`),
  ],
);

export const projectorState = pgTable("projector_state", {
  projectorName: text("projector_name").primaryKey(),
  lastProcessedEventId: bigint("last_processed_event_id", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
});
