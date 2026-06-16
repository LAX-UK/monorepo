import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { sourceOfFundsDocument } from "./source-of-funds-documents.js";
import { sourceOfFunds } from "./source-of-funds.js";

/** CQRS read model: latest staff verification checklist per document (folded from events). */
export const sourceOfFundsDocumentReview = pgTable(
  "source_of_funds_document_review",
  {
    documentId: uuid("document_id")
      .primaryKey()
      .references(() => sourceOfFundsDocument.id, { onDelete: "cascade" }),
    sourceOfFundsId: uuid("source_of_funds_id")
      .notNull()
      .references(() => sourceOfFunds.id, { onDelete: "cascade" }),
    reviewedByUserId: text("reviewed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }).notNull(),
    /** Fixed checklist answers (matchesDeclaredSource, coversExposure, recentEnough, legibleComplete). */
    checks: jsonb("checks").notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
  },
  (table) => [index("source_of_funds_document_review_case_idx").on(table.sourceOfFundsId)],
);

export const sourceOfFundsDocumentReviewRelations = relations(
  sourceOfFundsDocumentReview,
  ({ one }) => ({
    document: one(sourceOfFundsDocument, {
      fields: [sourceOfFundsDocumentReview.documentId],
      references: [sourceOfFundsDocument.id],
    }),
    sourceOfFunds: one(sourceOfFunds, {
      fields: [sourceOfFundsDocumentReview.sourceOfFundsId],
      references: [sourceOfFunds.id],
    }),
    reviewedBy: one(user, {
      fields: [sourceOfFundsDocumentReview.reviewedByUserId],
      references: [user.id],
    }),
  }),
);
