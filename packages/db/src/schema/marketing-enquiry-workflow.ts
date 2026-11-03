import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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

/** A reply staff sent to the sender, queued through the email outbox. */
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
  },
  (table) => [
    foreignKey({
      name: "marketing_enquiry_message_enquiry_id_fk",
      columns: [table.enquiryId],
      foreignColumns: [marketingEnquiry.id],
    }).onDelete("cascade"),
    index("marketing_enquiry_message_enquiry_idx").on(table.enquiryId, table.createdAt),
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
