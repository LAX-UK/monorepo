import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { uploadObject } from "./upload-objects.js";

export const legalEntityDocument = pgTable(
  "legal_entity_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("legal_entity_document_entity_review_status_idx").on(
      table.legalEntityId,
      table.reviewStatus,
    ),
    index("legal_entity_document_pending_review_idx")
      .on(table.reviewStatus, table.uploadedAt)
      .where(sql`${table.reviewStatus} = 'pending'`),
  ],
);

export const legalEntityDocumentRelations = relations(legalEntityDocument, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [legalEntityDocument.legalEntityId],
    references: [legalEntity.id],
  }),
  uploadObject: one(uploadObject, {
    fields: [legalEntityDocument.uploadObjectId],
    references: [uploadObject.id],
  }),
  reviewedBy: one(user, {
    fields: [legalEntityDocument.reviewedByUserId],
    references: [user.id],
  }),
  uploadedBy: one(user, {
    fields: [legalEntityDocument.uploadedByUserId],
    references: [user.id],
  }),
}));
