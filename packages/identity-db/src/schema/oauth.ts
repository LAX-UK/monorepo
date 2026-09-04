import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth.js";

export const oauthApplication = pgTable(
  "oauth_application",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: boolean("disabled").notNull().default(false),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required")
      .notNull()
      .default(false),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("oauth_application_user_id_idx").on(table.userId)],
);

/** Identity-owned RP session registry for targeted OIDC back-channel logout. */
export const oidcRpSession = pgTable(
  "oidc_rp_session",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sid: text("sid").notNull(),
    identitySessionId: text("identity_session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    primaryKey({
      name: "oidc_rp_session_client_sid_pk",
      columns: [table.clientId, table.sid],
    }),
    index("oidc_rp_session_identity_session_idx").on(table.identitySessionId),
    index("oidc_rp_session_subject_id_idx").on(table.subjectId),
    index("oidc_rp_session_subject_client_idx").on(table.subjectId, table.clientId),
    index("oidc_rp_session_revoked_retention_idx")
      .on(table.revokedAt)
      .where(sql`${table.revokedAt} is not null`),
    index("oidc_rp_session_active_last_seen_idx")
      .on(table.lastSeenAt)
      .where(sql`${table.revokedAt} is null`),
  ],
);

/** Durable Identity-owned outbox for asynchronous OIDC back-channel logout. */
export const oidcBackchannelLogoutDelivery = pgTable(
  "oidc_backchannel_logout_delivery",
  {
    id: text("id").primaryKey(),
    eventKey: text("event_key").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sid: text("sid"),
    tokenJti: text("token_jti").notNull(),
    tokenIat: integer("token_iat").notNull(),
    endpoint: text("endpoint").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { mode: "date", withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("oidc_backchannel_logout_due_idx").on(table.status, table.nextAttemptAt),
    index("oidc_backchannel_logout_subject_idx").on(table.subjectId),
    index("oidc_backchannel_logout_retention_idx").on(table.status, table.updatedAt),
  ],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    /** One-way `h1:` fingerprint in production; the raw bearer is returned only at issuance. */
    accessToken: text("access_token").notNull().unique(),
    /** One-way `h1:` fingerprint in production; legacy plaintext rows require the backfill. */
    refreshToken: text("refresh_token").notNull().unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    /** Stable rotation family used to revoke all descendants after token reuse. */
    refreshFamilyId: text("refresh_family_id"),
    /** Unprefixed SHA-256/base64url fingerprint used by rotation-family queries. */
    refreshTokenHash: text("refresh_token_hash"),
    refreshConsumedAt: timestamp("refresh_consumed_at", {
      mode: "date",
      withTimezone: true,
    }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("oauth_access_token_client_id_idx").on(table.clientId),
    index("oauth_access_token_user_id_idx").on(table.userId),
    index("oauth_access_token_refresh_family_idx").on(table.refreshFamilyId),
    uniqueIndex("oauth_access_token_refresh_hash_uidx")
      .on(table.refreshTokenHash)
      .where(sql`${table.refreshTokenHash} is not null`),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    consentGiven: boolean("consent_given").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_consent_client_user_uidx").on(table.clientId, table.userId),
    index("oauth_consent_client_id_idx").on(table.clientId),
    index("oauth_consent_user_id_idx").on(table.userId),
  ],
);
