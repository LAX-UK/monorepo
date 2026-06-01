import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** KYC status for identity verification */
export const userKycStatusEnum = pgEnum("user_kyc_status", [
  "unverified",
  "pending",
  "approved",
  "rejected",
]);

/** LAX internal staff role when `user.role` is `staff` (required; null only before backfill). */
export const userStaffRoleEnum = pgEnum("user_staff_role", [
  "super_admin",
  "auction_manager",
  "catalogue_manager",
  "specialist",
  "finance_ops",
  "operations_fulfilment",
  "content_marketing",
  "support_concierge",
  "staff_viewer",
  "compliance_officer",
]);

/**
 * AML hold disposition for a user. `hold` pauses money-path progression pending
 * compliance review; `blocked` is terminal (confirmed sanctions) and requires
 * explicit MLRO action to lift.
 */
export const userAmlHoldStatusEnum = pgEnum("user_aml_hold_status", ["none", "hold", "blocked"]);

/** Better Auth core tables — extended with `role` on `user`. */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    mobile: text("mobile"),
    /** ISO 3166-1 alpha-2 region for formatting `mobile` (E.164). */
    mobileCountry: text("mobile_country"),
    /** Stored lowercased + trimmed; uniqueness enforced by `user_email_lower_uidx`. */
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("client"),
    /** Internal LAX staff specialization; required when `role` is `staff`. */
    staffRole: userStaffRoleEnum("staff_role"),
    emailStatus: text("email_status").notNull().default("ok"),
    emailStatusChangedAt: timestamp("email_status_changed_at", {
      mode: "date",
      withTimezone: true,
    }),
    suspendedAt: timestamp("suspended_at", { mode: "date", withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    /** Identity verification KYC status */
    kycStatus: userKycStatusEnum("kyc_status").notNull().default("unverified"),
    /** Latest provider session id; webhooks for older sessions are ignored for user state. */
    currentKycSessionId: text("current_kyc_session_id"),
    /** Count of hard verification failures (not `requires_input` retries). */
    kycRetryCount: integer("kyc_retry_count").notNull().default(0),
    kycVerifiedAt: timestamp("kyc_verified_at", { mode: "date", withTimezone: true }),
    /** AML/sanctions hold disposition (drives settlement gating). */
    amlHoldStatus: userAmlHoldStatusEnum("aml_hold_status").notNull().default("none"),
    /** Machine-readable reason for the current AML hold (e.g. `sanctions_match`). */
    amlHoldReason: text("aml_hold_reason"),
    amlHoldAt: timestamp("aml_hold_at", { mode: "date", withTimezone: true }),
    /** Persona captured at signup ('individual' | 'organisation'); drives post-verify routing. */
    signupPersona: text("signup_persona"),
    dateOfBirth: date("date_of_birth"),
    /** first-time acting context tooltip dismissed */
    hasSeenActingContextTooltip: boolean("has_seen_acting_context_tooltip")
      .notNull()
      .default(false),
    /** In-flight email change: new address; cleared after both sides confirm or expiry. */
    pendingNewEmail: text("pending_new_email"),
    emailChangeOldOk: boolean("email_change_old_ok").notNull().default(false),
    emailChangeNewOk: boolean("email_change_new_ok").notNull().default(false),
    emailChangeExpiresAt: timestamp("email_change_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("user_email_idx").on(table.email),
    uniqueIndex("user_email_lower_uidx").on(sql`lower(trim(${table.email}))`),
    uniqueIndex("user_pending_new_email_lower_uidx")
      .on(sql`lower(trim(${table.pendingNewEmail}))`)
      .where(sql`${table.pendingNewEmail} IS NOT NULL`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Step-up re-auth: last time user proved password on this session (password sign-in or /auth/reauth). */
    lastPasswordAuthAt: timestamp("last_password_auth_at", {
      mode: "date",
      withTimezone: true,
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_user_id_provider_id_uidx").on(table.userId, table.providerId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

/** Better Auth `two-factor` plugin backing table (model name `twoFactor`). */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
  },
  (table) => [uniqueIndex("two_factor_user_id_uidx").on(table.userId)],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactor: one(twoFactor, {
    fields: [user.id],
    references: [twoFactor.userId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));
