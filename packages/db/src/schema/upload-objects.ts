import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const uploadObject = pgTable(
  "upload_object",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The owner when a signed-in person uploaded the file. Exactly one of the two owners is set. */
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
    /** The enquiry draft a visitor without an account uploaded the file for. */
    enquiryDraftId: uuid("enquiry_draft_id"),
    kind: text("kind").notNull(),
    key: text("key").notNull().unique(),
    declaredContentType: text("declared_content_type").notNull(),
    declaredByteSize: integer("declared_byte_size").notNull(),
    actualContentType: text("actual_content_type"),
    actualByteSize: integer("actual_byte_size"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }),
    validatedAt: timestamp("validated_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("upload_object_owner_status_idx").on(table.ownerUserId, table.status),
    index("upload_object_status_expires_idx").on(table.status, table.expiresAt),
    index("upload_object_enquiry_draft_idx")
      .on(table.enquiryDraftId)
      .where(sql`${table.enquiryDraftId} IS NOT NULL`),
    index("upload_object_enquiry_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.kind} IN ('enquiry_image', 'enquiry_document')`),
    check(
      "upload_object_single_owner_check",
      sql`num_nonnulls(${table.ownerUserId}, ${table.enquiryDraftId}) = 1`,
    ),
  ],
);
