import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { sourceOfFunds } from "./source-of-funds.js";
import { uploadObject } from "./upload-objects.js";

/**
 * Buyer-submitted Source-of-Funds evidence linked to a case. Append-only: re-uploads
 * insert a new row and mark prior rows for the same `requestedType` as superseded.
 */
export const sourceOfFundsDocument = pgTable(
  "source_of_funds_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceOfFundsId: uuid("source_of_funds_id")
      .notNull()
      .references(() => sourceOfFunds.id, { onDelete: "cascade" }),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    /** Checklist item this file satisfies (maps to staff request). */
    requestedType: text("requested_type").notNull(),
    /** Optional buyer label (e.g. "January bank statement"). */
    label: text("label"),
    reviewStatus: text("review_status").notNull().default("pending"),
    /** AML retention class for scheduled purge (default 5y from case resolution). */
    retentionClass: text("retention_class").notNull().default("aml_5y"),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { mode: "date", withTimezone: true }),
    /** Set when retention job anonymizes the row after purge. */
    anonymizedAt: timestamp("anonymized_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("source_of_funds_document_case_idx").on(table.sourceOfFundsId),
    index("source_of_funds_document_case_type_idx").on(table.sourceOfFundsId, table.requestedType),
    index("source_of_funds_document_retention_idx")
      .on(table.retentionClass, table.anonymizedAt)
      .where(sql`${table.anonymizedAt} IS NULL`),
  ],
);

export const sourceOfFundsDocumentRelations = relations(sourceOfFundsDocument, ({ one }) => ({
  sourceOfFunds: one(sourceOfFunds, {
    fields: [sourceOfFundsDocument.sourceOfFundsId],
    references: [sourceOfFunds.id],
  }),
  uploadObject: one(uploadObject, {
    fields: [sourceOfFundsDocument.uploadObjectId],
    references: [uploadObject.id],
  }),
  uploadedBy: one(user, {
    fields: [sourceOfFundsDocument.uploadedByUserId],
    references: [user.id],
  }),
}));
