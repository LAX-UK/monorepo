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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consignment_thread_submission_uidx").on(table.submissionId),
    index("consignment_thread_inbox_idx").on(table.lastMessageSide, table.lastMessageAt),
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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consignment_message_thread_created_idx").on(table.threadId, table.createdAt),
    index("consignment_message_unread_idx")
      .on(table.threadId, table.authorSide)
      .where(sql`${table.readAt} IS NULL`),
    check("consignment_message_side_check", sql`${table.authorSide} IN ('client', 'staff')`),
    check("consignment_message_body_length_check", sql`char_length(${table.body}) <= 4000`),
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
