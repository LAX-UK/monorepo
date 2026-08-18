import { relations, sql } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user, userAmlHoldStatusEnum, userKycStatusEnum, userStaffRoleEnum } from "./auth.js";

/** Bid-owned authorization, compliance summary, and auction profile keyed by Identity subject. */
export const bidUserProfile = pgTable(
  "bid_user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("client"),
    staffRole: userStaffRoleEnum("staff_role"),
    emailStatus: text("email_status").notNull().default("ok"),
    emailStatusChangedAt: timestamp("email_status_changed_at", {
      mode: "date",
      withTimezone: true,
    }),
    suspendedAt: timestamp("suspended_at", { mode: "date", withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    /** Global Identity disablement projected locally; distinct from Bid suspension. */
    identityDisabledAt: timestamp("identity_disabled_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Canonical Identity subject for retired aliases. Retired rows remain unusable. */
    mergedIntoSubjectId: text("merged_into_subject_id"),
    kycStatus: userKycStatusEnum("kyc_status").notNull().default("unverified"),
    currentKycSessionId: text("current_kyc_session_id"),
    kycRetryCount: integer("kyc_retry_count").notNull().default(0),
    kycVerifiedAt: timestamp("kyc_verified_at", { mode: "date", withTimezone: true }),
    preferredPaddleNumber: integer("preferred_paddle_number"),
    amlHoldStatus: userAmlHoldStatusEnum("aml_hold_status").notNull().default("none"),
    amlHoldReason: text("aml_hold_reason"),
    amlHoldAt: timestamp("aml_hold_at", { mode: "date", withTimezone: true }),
    signupPersona: text("signup_persona"),
    dateOfBirth: date("date_of_birth"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    mobile: text("mobile"),
    mobileCountry: text("mobile_country"),
    hasSeenActingContextTooltip: boolean("has_seen_acting_context_tooltip")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("bid_user_profile_role_active_idx")
      .on(table.role)
      .where(sql`${table.suspendedAt} IS NULL`),
    index("bid_user_profile_kyc_status_idx").on(table.kycStatus),
    index("bid_user_profile_identity_active_idx")
      .on(table.userId)
      .where(sql`${table.identityDisabledAt} IS NULL AND ${table.mergedIntoSubjectId} IS NULL`),
  ],
);

export const bidUserProfileRelations = relations(bidUserProfile, ({ one }) => ({
  user: one(user, {
    fields: [bidUserProfile.userId],
    references: [user.id],
  }),
}));
