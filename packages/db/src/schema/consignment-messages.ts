import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { itemSubmission } from "./item-submissions.js";
import { uploadObject } from "./upload-objects.js";

/**
 * The thread on one consignment between the account's people and LAX's specialists. Created
 * with its first message. The newest message's time and side are kept on the thread, so the
 * staff inbox can list threads waiting for an answer without reading every message.
 */
export const consignmentThread = pgTable(
  "consignment_thread",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { mode: "date", withTimezone: true }).notNull(),
    /** Who wrote the newest message: `client` means the thread waits for LAX. */
    lastMessageSide: text("last_message_side").notNull(),
    /** When staff closed the thread; a client message or a staff reply reopens it. */
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    closedByUserId: text("closed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** A colleague answering this thread while the consignment keeps its specialist. */
    coveringUserId: text("covering_user_id").references(() => user.id, { onDelete: "set null" }),
    /** When the cover ends and the thread goes back to the specialist; null runs until ended. */
    coveringUntil: timestamp("covering_until", { mode: "date", withTimezone: true }),
    /**
     * The first client message after the last reply the client can see; null when nobody waits.
     * The reply clock counts from here.
     */
    awaitingSince: timestamp("awaiting_since", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consignment_thread_submission_uidx").on(table.submissionId),
    index("consignment_thread_inbox_idx").on(table.lastMessageSide, table.lastMessageAt),
    index("consignment_thread_waiting_idx")
      .on(table.awaitingSince)
      .where(sql`${table.closedAt} IS NULL AND ${table.awaitingSince} IS NOT NULL`),
    index("consignment_thread_closed_idx")
      .on(table.closedAt)
      .where(sql`${table.closedAt} IS NOT NULL`),
    index("consignment_thread_covering_idx")
      .on(table.coveringUserId)
      .where(sql`${table.coveringUserId} IS NOT NULL`),
    index("consignment_thread_cover_end_idx")
      .on(table.coveringUntil)
      .where(sql`${table.coveringUserId} IS NOT NULL AND ${table.coveringUntil} IS NOT NULL`),
    check(
      "consignment_thread_last_side_check",
      sql`${table.lastMessageSide} IN ('client', 'staff')`,
    ),
  ],
);

/**
 * One message. `readAt` is when the other side first read it: a staff message is read by the
 * account (any member who answers), a client message by LAX. The author's name is read from the
 * user at display time; a deleted user leaves the message with no author.
 */
export const consignmentMessage = pgTable(
  "consignment_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => consignmentThread.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
    authorSide: text("author_side").notNull(),
    body: text("body").notNull().default(""),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    /** `internal` is a note for staff only; the account never sees it. */
    visibility: text("visibility").notNull().default("thread"),
    /**
     * A staff reply stays with staff until this time (the window to take it back); the account
     * sees it, and is told, only afterwards. Null for messages that were never held.
     */
    deliverAfter: timestamp("deliver_after", { mode: "date", withTimezone: true }),
    /** When the account was told of a staff reply; set once. */
    notifiedAt: timestamp("notified_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consignment_message_thread_created_idx").on(table.threadId, table.createdAt),
    index("consignment_message_unread_idx")
      .on(table.threadId, table.authorSide)
      .where(sql`${table.readAt} IS NULL`),
    index("consignment_message_unnotified_idx")
      .on(table.deliverAfter)
      .where(sql`${table.notifiedAt} IS NULL AND ${table.deliverAfter} IS NOT NULL`),
    check("consignment_message_side_check", sql`${table.authorSide} IN ('client', 'staff')`),
    check("consignment_message_body_length_check", sql`char_length(${table.body}) <= 4000`),
    check(
      "consignment_message_visibility_check",
      sql`${table.visibility} IN ('thread', 'internal')`,
    ),
    check(
      "consignment_message_internal_staff_check",
      sql`${table.visibility} = 'thread' OR ${table.authorSide} = 'staff'`,
    ),
  ],
);

/** A checked upload (photo or PDF) sent with a message. An upload is attached once. */
export const consignmentMessageAttachment = pgTable(
  "consignment_message_attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => consignmentMessage.id, { onDelete: "cascade" }),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    /** The file's name as the sender's device gave it, shown on the attachment line. */
    fileName: text("file_name"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consignment_message_attachment_message_idx").on(table.messageId),
    uniqueIndex("consignment_message_attachment_upload_uidx").on(table.uploadObjectId),
  ],
);

/** What happened to a thread's ownership and state. A null actor is the client's message. */
export const consignmentThreadEvent = pgTable(
  "consignment_thread_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => consignmentThread.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    /** The person assigned or covering. */
    subjectUserId: text("subject_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consignment_thread_event_thread_idx").on(table.threadId, table.createdAt),
    check(
      "consignment_thread_event_kind_check",
      sql`${table.kind} IN ('assigned', 'unassigned', 'covering', 'closed', 'reopened')`,
    ),
  ],
);

/** A reply the team shares and inserts into a thread. Titles are unique, ignoring case. */
export const consignmentSavedReply = pgTable(
  "consignment_saved_reply",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consignment_saved_reply_title_uidx").on(sql`lower(${table.title})`),
    check("consignment_saved_reply_body_length_check", sql`char_length(${table.body}) <= 4000`),
  ],
);

export const consignmentThreadRelations = relations(consignmentThread, ({ one, many }) => ({
  submission: one(itemSubmission, {
    fields: [consignmentThread.submissionId],
    references: [itemSubmission.id],
  }),
  messages: many(consignmentMessage),
}));

export const consignmentMessageRelations = relations(consignmentMessage, ({ one, many }) => ({
  thread: one(consignmentThread, {
    fields: [consignmentMessage.threadId],
    references: [consignmentThread.id],
  }),
  attachments: many(consignmentMessageAttachment),
}));

export const consignmentMessageAttachmentRelations = relations(
  consignmentMessageAttachment,
  ({ one }) => ({
    message: one(consignmentMessage, {
      fields: [consignmentMessageAttachment.messageId],
      references: [consignmentMessage.id],
    }),
  }),
);
