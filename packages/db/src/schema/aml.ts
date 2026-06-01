import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const amlMatchStatusEnum = pgEnum("aml_match_status", [
  "no_match",
  "possible_match",
  "confirmed_match",
  "false_positive",
]);

export const amlMonitorStatusEnum = pgEnum("aml_monitor_status", [
  "not_monitored",
  "monitored",
  "monitoring_paused",
]);

export const amlDecisionOutcomeEnum = pgEnum("aml_decision_outcome", ["clear", "review", "block"]);

export const amlReviewStatusEnum = pgEnum("aml_review_status", [
  "not_required",
  "pending",
  "cleared",
  "blocked",
]);

/** First-line analyst recommendation (advisory) in the maker-checker flow. */
export const amlTriageRecommendationEnum = pgEnum("aml_triage_recommendation", [
  "recommend_clear",
  "recommend_block",
]);

/**
 * Sanctions / PEP / adverse-media watchlist screening result for a Veriff
 * session (Premium "PEP & Sanctions" add-on). One row per provider session;
 * later monitoring updates upsert onto the same row.
 */
export const kycWatchlistScreening = pgTable(
  "kyc_watchlist_screening",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("veriff"),
    providerSessionId: text("provider_session_id").notNull().unique(),
    matchStatus: amlMatchStatusEnum("match_status").notNull(),
    monitorStatus: amlMonitorStatusEnum("monitor_status").notNull().default("not_monitored"),
    totalHits: integer("total_hits").notNull().default(0),
    /** Distinct watchlist categories present across hits (sanction/pep/adverse_media/…). */
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    decisionOutcome: amlDecisionOutcomeEnum("decision_outcome").notNull(),
    reviewStatus: amlReviewStatusEnum("review_status").notNull().default("not_required"),
    /** First-line analyst triage (maker) — advisory recommendation + author. */
    triageRecommendation: amlTriageRecommendationEnum("triage_recommendation"),
    triagedByUserId: text("triaged_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    triagedAt: timestamp("triaged_at", { mode: "date", withTimezone: true }),
    triageNotes: text("triage_notes"),
    /** Final MLRO (checker) disposition. */
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    /** Full provider payload (PII); access restricted to compliance roles. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    screenedAt: timestamp("screened_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("kyc_watchlist_screening_user_id_idx").on(table.userId),
    index("kyc_watchlist_screening_review_status_idx").on(table.reviewStatus),
    index("kyc_watchlist_screening_decision_outcome_idx").on(table.decisionOutcome),
  ],
);

export const kycWatchlistScreeningRelations = relations(kycWatchlistScreening, ({ one }) => ({
  user: one(user, {
    fields: [kycWatchlistScreening.userId],
    references: [user.id],
  }),
  reviewedBy: one(user, {
    fields: [kycWatchlistScreening.reviewedByUserId],
    references: [user.id],
  }),
  triagedBy: one(user, {
    fields: [kycWatchlistScreening.triagedByUserId],
    references: [user.id],
  }),
}));
