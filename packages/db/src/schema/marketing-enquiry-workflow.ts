import {
  INBOUND_DKIM_RESULTS,
  INBOUND_SPF_RESULTS,
  type InboundDkimResult,
  type InboundSpfResult,
} from "@auction/domain";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
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
import { marketingEnquiry } from "./marketing-enquiry.js";
import { uploadObject } from "./upload-objects.js";

/** A photo or document that came with an enquiry. */
export const marketingEnquiryAttachment = pgTable(
  "marketing_enquiry_attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enquiryId: uuid("enquiry_id").notNull(),
    uploadObjectId: uuid("upload_object_id").notNull(),
    kind: text("kind").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "marketing_enquiry_attachment_enquiry_id_fk",
      columns: [table.enquiryId],
      foreignColumns: [marketingEnquiry.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "marketing_enquiry_attachment_upload_object_id_fk",
      columns: [table.uploadObjectId],
      foreignColumns: [uploadObject.id],
    }).onDelete("cascade"),
    uniqueIndex("marketing_enquiry_attachment_position_uidx").on(
      table.enquiryId,
      table.kind,
      table.position,
    ),
    uniqueIndex("marketing_enquiry_attachment_upload_uidx").on(table.uploadObjectId),
    check("marketing_enquiry_attachment_kind_check", sql`${table.kind} IN ('image', 'document')`),
    check("marketing_enquiry_attachment_position_check", sql`${table.position} >= 0`),
  ],
);

/** An internal note on an enquiry; the sender never sees it. */
export const marketingEnquiryNote = pgTable(
  "marketing_enquiry_note",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enquiryId: uuid("enquiry_id").notNull(),
    authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "marketing_enquiry_note_enquiry_id_fk",
      columns: [table.enquiryId],
      foreignColumns: [marketingEnquiry.id],
    }).onDelete("cascade"),
    index("marketing_enquiry_note_enquiry_idx").on(table.enquiryId, table.createdAt),
    check("marketing_enquiry_note_body_check", sql`char_length(${table.body}) BETWEEN 1 AND 5000`),
  ],
);

/** The metadata of one file that came with a reply. The file itself is not downloaded or stored. */
export type InboundAttachmentMeta = { name: string; contentType: string; sizeBytes: number };

const SPF_CHECK_LIST = sql.raw(INBOUND_SPF_RESULTS.map((v) => `'${v}'`).join(", "));
const DKIM_CHECK_LIST = sql.raw(INBOUND_DKIM_RESULTS.map((v) => `'${v}'`).join(", "));

/**
 * One message on an enquiry thread: a reply staff sent to the sender (queued through the email
 * outbox), or a reply the sender emailed back (`direction = 'inbound'`, received on the Postmark
 * inbound webhook, tied to the thread by its unguessable reply address or by In-Reply-To).
 */
export const marketingEnquiryMessage = pgTable(
  "marketing_enquiry_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enquiryId: uuid("enquiry_id").notNull(),
    sentByUserId: text("sent_by_user_id").references(() => user.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    outboxId: uuid("outbox_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    direction: text("direction").notNull().default("outbound"),
    /** Inbound only: Postmark's MessageID, the idempotency key of the webhook. */
    providerMessageId: text("provider_message_id"),
    /** Inbound only: a hash of the From address, so the address itself is not kept twice. */
    fromEmailHash: text("from_email_hash"),
    /** Inbound only: how the reply was tied to the thread. */
    matchedBy: text("matched_by"),
    /** Inbound only: name, type and size of each file; the files are not stored. */
    attachments: jsonb("attachments")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<InboundAttachmentMeta[]>(),
    /** Inbound only: the SPF result the receiving server recorded. */
    spfResult: text("spf_result").$type<InboundSpfResult>(),
    /** Inbound only: the DKIM result, `pass` only for a signature aligned with the From domain. */
    dkimResult: text("dkim_result").$type<InboundDkimResult>(),
  },
  (table) => [
    foreignKey({
      name: "marketing_enquiry_message_enquiry_id_fk",
      columns: [table.enquiryId],
      foreignColumns: [marketingEnquiry.id],
    }).onDelete("cascade"),
    index("marketing_enquiry_message_enquiry_idx").on(table.enquiryId, table.createdAt),
    uniqueIndex("marketing_enquiry_message_provider_uidx")
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} IS NOT NULL`),
    index("marketing_enquiry_message_outbox_idx")
      .on(table.outboxId)
      .where(sql`${table.outboxId} IS NOT NULL`),
    check(
      "marketing_enquiry_message_direction_check",
      sql`${table.direction} IN ('outbound', 'inbound')`,
    ),
    check(
      "marketing_enquiry_message_inbound_check",
      sql`${table.direction} = 'outbound' OR (${table.providerMessageId} IS NOT NULL AND ${table.matchedBy} IN ('token', 'in_reply_to', 'staff') AND char_length(${table.body}) <= 20000 AND char_length(${table.subject}) <= 300 AND jsonb_typeof(${table.attachments}) = 'array')`,
    ),
    check(
      "marketing_enquiry_message_spf_result_check",
      sql`${table.spfResult} IS NULL OR ${table.spfResult} IN (${SPF_CHECK_LIST})`,
    ),
    check(
      "marketing_enquiry_message_dkim_result_check",
      sql`${table.dkimResult} IS NULL OR ${table.dkimResult} IN (${DKIM_CHECK_LIST})`,
    ),
  ],
);

/**
 * Who receives a department's enquiries. A row with no department is the fallback for every
 * enquiry whose department has no row of its own.
 */
export const enquiryRoutingRule = pgTable(
  "enquiry_routing_rule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentSlug: text("department_slug"),
    assignedToUserId: text("assigned_to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("enquiry_routing_rule_department_uidx")
      .on(table.departmentSlug)
      .where(sql`${table.departmentSlug} IS NOT NULL`),
    uniqueIndex("enquiry_routing_rule_fallback_uidx")
      .on(sql`(true)`)
      .where(sql`${table.departmentSlug} IS NULL`),
  ],
);

/**
 * Inbound mail that could not be tied to an enquiry thread with confidence: no valid reply
 * address, a sender who is not the enquirer, failed SPF, or an automatic reply. It is held here
 * for staff review and never attached to a thread. Kept 30 days, then purged.
 */
export const enquiryInboundQuarantine = pgTable(
  "enquiry_inbound_quarantine",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Postmark's MessageID: a replayed delivery is the same row. */
    providerMessageId: text("provider_message_id").notNull(),
    reason: text("reason").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    attachments: jsonb("attachments")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<InboundAttachmentMeta[]>(),
    /** The enquiry the reply address named, when it named a real one (the reply was still held back). */
    suspectedEnquiryId: uuid("suspected_enquiry_id"),
    status: text("status").notNull().default("pending"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    purgeAt: timestamp("purge_at", { mode: "date", withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    spfResult: text("spf_result").$type<InboundSpfResult>(),
    dkimResult: text("dkim_result").$type<InboundDkimResult>(),
  },
  (table) => [
    uniqueIndex("enquiry_inbound_quarantine_provider_uidx").on(table.providerMessageId),
    index("enquiry_inbound_quarantine_pending_idx")
      .on(table.receivedAt)
      .where(sql`${table.status} = 'pending'`),
    index("enquiry_inbound_quarantine_purge_idx").on(table.purgeAt),
    check(
      "enquiry_inbound_quarantine_reason_check",
      sql`${table.reason} IN ('unmatched', 'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply', 'unauthenticated')`,
    ),
    check(
      "enquiry_inbound_quarantine_status_check",
      sql`${table.status} IN ('pending', 'dismissed', 'linked')`,
    ),
    check(
      "enquiry_inbound_quarantine_reviewed_check",
      sql`(${table.status} = 'pending') = (${table.reviewedAt} IS NULL)`,
    ),
    check(
      "enquiry_inbound_quarantine_size_check",
      sql`char_length(${table.body}) <= 20000 AND char_length(${table.subject}) <= 300 AND char_length(${table.fromAddress}) <= 320`,
    ),
    check(
      "enquiry_inbound_quarantine_spf_result_check",
      sql`${table.spfResult} IS NULL OR ${table.spfResult} IN (${SPF_CHECK_LIST})`,
    ),
    check(
      "enquiry_inbound_quarantine_dkim_result_check",
      sql`${table.dkimResult} IS NULL OR ${table.dkimResult} IN (${DKIM_CHECK_LIST})`,
    ),
  ],
);
