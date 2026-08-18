import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { domainEvent } from "./domain-events.js";

/** Identity-owned SSF stream configuration for registered first-party receivers. */
export const ssfStream = pgTable(
  "ssf_stream",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    receiverId: text("receiver_id").notNull(),
    audience: text("audience").notNull(),
    endpoint: text("endpoint").notNull(),
    status: text("status").notNull().default("disabled"),
    eventsRequested: jsonb("events_requested").$type<string[]>().notNull(),
    eventsDelivered: jsonb("events_delivered").$type<string[]>().notNull(),
    signingAlgorithm: text("signing_algorithm").notNull().default("RS256"),
    signingKid: text("signing_kid"),
    /** Independent SSF source checkpoint; never reuses worker projector state. */
    lastMappedEventId: bigint("last_mapped_event_id", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ssf_stream_client_receiver_uid").on(table.clientId, table.receiverId),
    index("ssf_stream_status_idx").on(table.status),
  ],
);

/**
 * One durable signed SET per stream/source event. Workers use status and claim
 * timestamps without mutating the shared domain_events outbox.
 */
export const ssfDelivery = pgTable(
  "ssf_delivery",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => ssfStream.id, { onDelete: "cascade" }),
    sourceEventId: bigint("source_event_id", { mode: "number" }).references(() => domainEvent.id, {
      onDelete: "restrict",
    }),
    eventType: text("event_type").notNull(),
    jti: text("jti").notNull(),
    txn: text("txn"),
    signingKid: text("signing_kid").notNull(),
    signingAlgorithm: text("signing_algorithm").notNull().default("RS256"),
    setToken: text("set_token").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { mode: "date", withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ssf_delivery_jti_uid").on(table.jti),
    uniqueIndex("ssf_delivery_stream_source_uid").on(table.streamId, table.sourceEventId),
    index("ssf_delivery_due_idx").on(table.status, table.nextAttemptAt),
    index("ssf_delivery_claimed_idx").on(table.status, table.claimedAt),
    index("ssf_delivery_retention_idx").on(table.status, table.updatedAt),
  ],
);

/** Receiver-local replay ledgers; each row is committed with the projection. */
export const bidSsfReplay = pgTable(
  "bid_ssf_replay",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bid_ssf_replay_expires_idx").on(table.expiresAt)],
);

export const shopSsfReplay = pgTable(
  "shop_ssf_replay",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("shop_ssf_replay_expires_idx").on(table.expiresAt)],
);
