import { sql } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { itemSubmission } from "./item-submissions.js";
import { legalEntity } from "./legal-entities.js";

/**
 * One consignment agreement per submission: the specialist's estimate and terms, proposed when
 * the work is accepted, and the seller's acceptance under a versioned set of seller conditions.
 * Acceptance records who accepted, when, and which version they read.
 */
export const consignmentAgreement = pgTable(
  "consignment_agreement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    termsVersion: text("terms_version").notNull(),
    estimateLow: numeric("estimate_low", { precision: 18, scale: 2 }),
    estimateHigh: numeric("estimate_high", { precision: 18, scale: 2 }),
    reservePrice: numeric("reserve_price", { precision: 18, scale: 2 }),
    commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }),
    currency: text("currency").notNull().default("GBP"),
    proposedByUserId: text("proposed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    proposedAt: timestamp("proposed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reminderDay3SentAt: timestamp("reminder_day3_sent_at", { mode: "date", withTimezone: true }),
    reminderDay7SentAt: timestamp("reminder_day7_sent_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consignment_agreement_submission_id_uidx").on(table.submissionId),
    index("consignment_agreement_legal_entity_id_idx").on(table.legalEntityId),
    index("consignment_agreement_awaiting_idx")
      .on(table.proposedAt)
      .where(sql`${table.acceptedAt} IS NULL`),
  ],
);
