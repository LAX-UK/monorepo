import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
  "changes_requested",
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
    /** What the specialist asked the seller to change; kept after resubmission for the record. */
    changesRequestedNote: text("changes_requested_note"),
    changesRequestedAt: timestamp("changes_requested_at", { mode: "date", withTimezone: true }),
    convertedLotId: uuid("converted_lot_id").references(() => lot.id, { onDelete: "set null" }),
    /**
     * The consignment's reference number, quoted when the seller phones a specialist. Given in
     * order from a sequence; the shown form ("C-1042") is a domain rule.
     */
    referenceNumber: bigint("reference_number", { mode: "number" })
      .notNull()
      .default(sql`nextval('item_submission_reference_seq')`),
    /** The member who created or last sent the submission; `null` for submissions from before it
     * was recorded. Organisations show a consignor only their own. */
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    draftReminderSentAt: timestamp("draft_reminder_sent_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** When staff last reminded the seller to verify their identity (at most once a day). */
    identityReminderSentAt: timestamp("identity_reminder_sent_at", {
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
    uniqueIndex("item_submission_reference_number_uidx").on(table.referenceNumber),
    index("item_submission_entity_submitted_by_idx").on(
      table.legalEntityId,
      table.submittedByUserId,
    ),
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
