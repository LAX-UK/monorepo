import { relations } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** KYC status for Stripe Identity verification */
export const userKycStatusEnum = pgEnum("user_kyc_status", [
  "unverified",
  "pending",
  "approved",
  "rejected",
]);

/** Better Auth core tables — extended with `role` on `user`. */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    mobile: text("mobile"),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("client"),
    emailStatus: text("email_status").notNull().default("ok"),
    emailStatusChangedAt: timestamp("email_status_changed_at", {
      mode: "date",
      withTimezone: true,
    }),
    suspendedAt: timestamp("suspended_at", { mode: "date", withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    /** Stripe Identity KYC status  */
    kycStatus: userKycStatusEnum("kyc_status").notNull().default("unverified"),
    kycVerifiedAt: timestamp("kyc_verified_at", { mode: "date", withTimezone: true }),
    dateOfBirth: date("date_of_birth"),
    /** first-time acting context tooltip dismissed */
    hasSeenActingContextTooltip: boolean("has_seen_acting_context_tooltip")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("user_email_idx").on(table.email)],
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
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
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
