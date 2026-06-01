import { relations } from "drizzle-orm";
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const sourceOfFundsStatusEnum = pgEnum("source_of_funds_status", [
  "pending",
  "approved",
  "rejected",
]);

/** Why SoF evidence was demanded (CDD Section 6). */
export const sourceOfFundsTriggerEnum = pgEnum("source_of_funds_trigger", [
  "threshold",
  "linked_transactions",
  "risk_indicator",
  "manual",
]);

/** First-line analyst recommendation (advisory) in the maker-checker flow. */
export const sourceOfFundsTriageRecommendationEnum = pgEnum(
  "source_of_funds_triage_recommendation",
  ["recommend_approve", "recommend_reject"],
);

/**
 * Source-of-Funds (SoF) case for a buyer (CDD Section 6). Opened when a buyer
 * crosses the SoF threshold (single transaction or aggregated linked
 * transactions) or when a risk indicator is present. Must be `approved` by an
 * MLRO/finance reviewer before the related settlement can proceed.
 */
export const sourceOfFunds = pgTable(
  "source_of_funds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: sourceOfFundsStatusEnum("status").notNull().default("pending"),
    trigger: sourceOfFundsTriggerEnum("trigger").notNull(),
    /** SoF threshold (GBP) in effect when the case was opened. */
    thresholdAmount: numeric("threshold_amount", { precision: 18, scale: 2 }).notNull(),
    /** Aggregated linked exposure (GBP) that triggered the case. */
    exposureAmount: numeric("exposure_amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("GBP"),
    /** Buyer-declared origin of funds (free text). */
    declaredSource: text("declared_source"),
    /** Upload-object keys for SoF documents (stored under the sensitive class). */
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    /** First-line analyst triage (maker) — advisory recommendation + author. */
    triageRecommendation: sourceOfFundsTriageRecommendationEnum("triage_recommendation"),
    triagedByUserId: text("triaged_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    triagedAt: timestamp("triaged_at", { mode: "date", withTimezone: true }),
    triageNotes: text("triage_notes"),
    /** Final MLRO/finance (checker) disposition. */
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("source_of_funds_user_id_idx").on(table.userId),
    index("source_of_funds_status_idx").on(table.status),
    index("source_of_funds_user_status_idx").on(table.userId, table.status),
  ],
);

export const sourceOfFundsRelations = relations(sourceOfFunds, ({ one }) => ({
  user: one(user, {
    fields: [sourceOfFunds.userId],
    references: [user.id],
  }),
  reviewedBy: one(user, {
    fields: [sourceOfFunds.reviewedByUserId],
    references: [user.id],
  }),
  triagedBy: one(user, {
    fields: [sourceOfFunds.triagedByUserId],
    references: [user.id],
  }),
}));
