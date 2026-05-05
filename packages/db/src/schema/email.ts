import { relations } from "drizzle-orm";
import {
  boolean,
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

export type EmailOutboxStatus = "pending" | "sending" | "sent" | "failed" | "suppressed";
export type EmailStream = "transactional" | "broadcast";
export type EmailCategory = "auth" | "transactional";
export type EmailEventType =
  | "delivered"
  | "bounce"
  | "soft_bounce"
  | "complaint"
  | "open"
  | "click"
  | "unsubscribe";
export type EmailSuppressionReason = "hard_bounce" | "complaint" | "manual" | "unsubscribe";
export type NewsletterSignupStatus = "queued" | "pushed" | "rejected" | "failed";

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    toEmailHash: text("to_email_hash").notNull(),
    toSnapshot: text("to_snapshot"),
    toSnapshotPurgeAt: timestamp("to_snapshot_purge_at", {
      mode: "date",
      withTimezone: true,
    }),
    template: text("template").notNull(),
    vars: jsonb("vars").notNull().$type<Record<string, unknown>>(),
    status: text("status").$type<EmailOutboxStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true }),
    lastError: text("last_error"),
    messageId: text("message_id"),
    stream: text("stream").$type<EmailStream>().notNull().default("transactional"),
    category: text("category").$type<EmailCategory>().notNull(),
    flaggedAddress: boolean("flagged_address").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("email_outbox_idempotency_key_uidx").on(table.idempotencyKey),
    index("email_outbox_status_created_at_idx").on(table.status, table.createdAt),
    index("email_outbox_user_id_idx").on(table.userId),
    index("email_outbox_message_id_idx").on(table.messageId),
    index("email_outbox_snapshot_purge_idx").on(table.toSnapshotPurgeAt),
  ],
);

export const emailEvent = pgTable(
  "email_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outboxId: uuid("outbox_id").references(() => emailOutbox.id, { onDelete: "set null" }),
    messageId: text("message_id"),
    type: text("type").$type<EmailEventType>().notNull(),
    provider: text("provider").notNull().default("postmark"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("email_event_message_id_idx").on(table.messageId),
    index("email_event_outbox_id_idx").on(table.outboxId),
    index("email_event_type_received_at_idx").on(table.type, table.receivedAt),
  ],
);

export const emailSuppression = pgTable("email_suppression", {
  emailHash: text("email_hash").primaryKey(),
  reason: text("reason").$type<EmailSuppressionReason>().notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export const newsletterSignupLog = pgTable(
  "newsletter_signup_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailHash: text("email_hash").notNull(),
    source: text("source").notNull(),
    status: text("status").$type<NewsletterSignupStatus>().notNull().default("queued"),
    zohoResponseCode: integer("zoho_response_code"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("newsletter_signup_log_email_hash_idx").on(table.emailHash),
    index("newsletter_signup_log_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const emailOutboxRelations = relations(emailOutbox, ({ one, many }) => ({
  user: one(user, {
    fields: [emailOutbox.userId],
    references: [user.id],
  }),
  events: many(emailEvent),
}));

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
  outbox: one(emailOutbox, {
    fields: [emailEvent.outboxId],
    references: [emailOutbox.id],
  }),
}));
