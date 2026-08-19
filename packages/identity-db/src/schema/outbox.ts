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

/** Identity-owned lifecycle outbox relayed into `domain_events` by the worker. */
export const identityLifecycleOutbox = pgTable(
  "identity_lifecycle_outbox",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    producer: text("producer").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    schemaVersion: integer("schema_version").notNull().default(1),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("identity_lifecycle_outbox_event_type_idx").on(table.eventType),
    index("identity_lifecycle_outbox_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("identity_lifecycle_outbox_occurred_at_idx").on(table.occurredAt),
    uniqueIndex("identity_lifecycle_outbox_user_email_verified_uid")
      .on(table.aggregateType, table.aggregateId)
      .where(sql`${table.eventType} = 'user.email_verified'`),
    uniqueIndex("identity_lifecycle_outbox_user_registered_uid")
      .on(table.aggregateType, table.aggregateId)
      .where(sql`${table.eventType} = 'user.registered'`),
  ],
);
