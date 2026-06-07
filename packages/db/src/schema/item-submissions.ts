import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

export const itemSubmissionStatusEnum = pgEnum("item_submission_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
]);

export const itemSubmission = pgTable(
  "item_submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, {
        onDelete: "restrict",
      }),
    title: text("title").notNull(),
    description: text("description"),
    medium: text("medium"),
    dimensions: text("dimensions"),
    images: text("images").array().notNull().default([]),
    yearOfWork: text("year_of_work"),
    isSigned: boolean("is_signed").notNull().default(false),
    signatureNote: text("signature_note"),
    edition: text("edition"),
    conditionSelfReport: text("condition_self_report"),
    provenance: jsonb("provenance")
      .$type<{ period?: string | undefined; note: string }[]>()
      .notNull()
      .default([]),
    exhibitions: jsonb("exhibitions")
      .$type<{ year?: string | undefined; venue: string; note?: string | undefined }[]>()
      .notNull()
      .default([]),
    askingPrice: numeric("asking_price", { precision: 18, scale: 2 }),
    reservePrice: numeric("reserve_price", { precision: 18, scale: 2 }),
    submitterNotes: text("submitter_notes"),
    status: itemSubmissionStatusEnum("status").notNull().default("draft"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),
    convertedLotId: uuid("converted_lot_id").references(() => lot.id, { onDelete: "set null" }),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    draftReminderSentAt: timestamp("draft_reminder_sent_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("item_submission_legal_entity_id_idx").on(table.legalEntityId),
    index("item_submission_status_created_at_idx").on(table.status, table.createdAt),
    index("item_submission_converted_lot_id_idx").on(table.convertedLotId),
    index("item_submission_assigned_to_idx")
      .on(table.assignedToUserId)
      .where(sql`${table.assignedToUserId} IS NOT NULL`),
  ],
);

export const itemSubmissionRelations = relations(itemSubmission, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [itemSubmission.legalEntityId],
    references: [legalEntity.id],
  }),
}));
