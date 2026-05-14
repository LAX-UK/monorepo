import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { itemSubmission } from "./item-submissions.js";
import { uploadObject } from "./upload-objects.js";

export const submissionDocument = pgTable(
  "submission_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label"),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("submission_document_submission_id_idx").on(table.submissionId)],
);

export const submissionDocumentRelations = relations(submissionDocument, ({ one }) => ({
  submission: one(itemSubmission, {
    fields: [submissionDocument.submissionId],
    references: [itemSubmission.id],
  }),
  upload: one(uploadObject, {
    fields: [submissionDocument.uploadObjectId],
    references: [uploadObject.id],
  }),
  createdBy: one(user, {
    fields: [submissionDocument.createdByUserId],
    references: [user.id],
  }),
}));
