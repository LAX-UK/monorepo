import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
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

/** LAX internal staff role when `bid_user_profile.role` is `staff`. Mirrors `userStaffRoles`. */
export const userStaffRoleEnum = pgEnum("user_staff_role", [
  "administrator",
  "sales_manager",
  "saleroom_clerk",
  "cataloguer",
  "specialist",
  "client_services",
  "finance",
  "fulfilment",
  "compliance",
  "read_only",
]);

/**
 * AML hold disposition for a user. `hold` pauses money-path progression pending
 * compliance review; `blocked` is terminal (confirmed sanctions) and requires
 * explicit MLRO action to lift.
 */
export const userAmlHoldStatusEnum = pgEnum("user_aml_hold_status", ["none", "hold", "blocked"]);

/** Better Auth core tables — Identity-owned credentials and lifecycle only. */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Canonical E.164 phone for Better Auth phoneNumber plugin + telephone bidding. */
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    /** Stored lowercased + trimmed; uniqueness enforced by `user_email_lower_uidx`. */
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** In-flight email change: new address; cleared after both sides confirm or expiry. */
    pendingNewEmail: text("pending_new_email"),
    emailChangeOldOk: boolean("email_change_old_ok").notNull().default(false),
    emailChangeNewOk: boolean("email_change_new_ok").notNull().default(false),
    emailChangeExpiresAt: timestamp("email_change_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    /**
     * How LAX Account picks the zone for this person's emails and dates: "automatic" follows the
     * device, "fixed" always uses `timeZone`.
     */
    timeZoneMode: text("time_zone_mode", { enum: ["automatic", "fixed"] })
      .notNull()
      .default("automatic"),
    /**
     * An IANA place zone. Fixed mode: the city the person chose. Automatic mode: the zone their
     * device last reported, or null before it has.
     */
    timeZone: text("time_zone"),
    /** When a device last changed the automatic zone; devices report at most once a day. */
    timeZoneReportedAt: timestamp("time_zone_reported_at", { mode: "date", withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Set while the daily purge is keeping a due deletion back because something is still open. */
    deletionHeldAt: timestamp("deletion_held_at", { mode: "date", withTimezone: true }),
    /** What was open when it was held: `{ code, message, href }[]`, no personal data. */
    deletionHoldReasons: jsonb("deletion_hold_reasons"),
    /** When the reminder before the purge was queued, so it is sent once. */
    deletionReminderSentAt: timestamp("deletion_reminder_sent_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Global Identity security disablement; distinct from Bid product suspension. */
    identityDisabledAt: timestamp("identity_disabled_at", {
      mode: "date",
      withTimezone: true,
    }),
    identityDisabledReason: text("identity_disabled_reason"),
    /** Canonical subject after an explicit account merge; retired rows remain as aliases. */
    mergedIntoSubjectId: text("merged_into_subject_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("user_email_idx").on(table.email),
    uniqueIndex("user_email_lower_uidx").on(sql`lower(trim(${table.email}))`),
    uniqueIndex("user_pending_new_email_lower_uidx")
      .on(sql`lower(trim(${table.pendingNewEmail}))`)
      .where(sql`${table.pendingNewEmail} IS NOT NULL`),
    uniqueIndex("user_phone_number_uidx")
      .on(table.phoneNumber)
      .where(sql`${table.phoneNumber} IS NOT NULL`),
    index("user_merged_into_subject_idx").on(table.mergedIntoSubjectId),
    check("user_time_zone_mode_valid", sql`${table.timeZoneMode} IN ('automatic', 'fixed')`),
    check(
      "user_time_zone_names_a_place",
      sql`${table.timeZone} IS NULL OR (position('/' in ${table.timeZone}) > 1 AND ${table.timeZone} NOT LIKE 'Etc/%')`,
    ),
    check(
      "user_fixed_time_zone_present",
      sql`${table.timeZoneMode} <> 'fixed' OR ${table.timeZone} IS NOT NULL`,
    ),
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
    /** Evidence that this exact browser session completed the TOTP challenge. */
    mfaCompletedAt: timestamp("mfa_completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Session was created by a social identity provider callback (counts as a second factor). */
    socialAuthAt: timestamp("social_auth_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Explicit successful reauthentication, distinct from ordinary password sign-in. */
    lastStepUpAt: timestamp("last_step_up_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** How this session was signed in: any of `SESSION_SIGN_IN_METHODS`. Empty when unknown. */
    amr: text("amr").array().notNull().default(sql`'{}'::text[]`),
    /**
     * Keyed hash of the private device marker the browser holds (`__Host-lax_device`), never the
     * marker itself. Null for records made before the marker existed. It only decides which record
     * a new sign-in in the same browser replaces; it never decides whether anyone is signed in.
     */
    deviceHash: text("device_hash"),
    /** When the person first signed in on this browser; carried over when a record is taken over. */
    signedInAt: timestamp("signed_in_at", { mode: "date", withTimezone: true }),
    /** Last real use of this browser's sign-in. */
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }),
    /** Country (ISO 3166-1 alpha-2) the edge reported at sign-in; never an address. */
    country: text("country"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_device_hash_user_idx")
      .on(table.deviceHash, table.userId)
      .where(sql`${table.deviceHash} IS NOT NULL`),
    // Serves the expiry sweep: WHERE expires_at <= now ORDER BY expires_at, id LIMIT n.
    index("session_expires_at_id_idx").on(table.expiresAt, table.id),
  ],
);

/**
 * The earlier ids a sign-in record stands for. A new sign-in in the same browser takes over that
 * browser's record: the old record is deleted and its id is kept here, so a product that still
 * holds the old id (its `sid`) keeps working against the record that replaced it. Consulted only
 * to renew, look up and end a sign-in, never to sign anyone in. At most 20 per record; rows go
 * with the record.
 */
export const sessionLineage = pgTable(
  "session_lineage",
  {
    previousSid: text("previous_sid").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("session_lineage_session_id_idx").on(table.sessionId),
    index("session_lineage_user_id_idx").on(table.userId),
  ],
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
    /**
     * The address a linked provider reported, sealed at rest like the provider tokens. Null for
     * the password account and for links made before it was recorded.
     */
    providerEmail: text("provider_email"),
    /** The provider reported a private relay address rather than the person's own. */
    providerEmailHidden: boolean("provider_email_hidden").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_user_id_provider_id_uidx").on(table.userId, table.providerId),
  ],
);

/**
 * A passkey: Better Auth's passkey plugin table (model `passkey`) plus `last_used_at`. At most 10
 * per person, enforced by a trigger. The public key and credential id stay inside the issuer;
 * only the name, the kind and the dates are ever shown or exported.
 */
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    credentialId: text("credential_id").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type").$type<"singleDevice" | "multiDevice">().notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("passkey_credential_id_uidx").on(table.credentialId),
    index("passkey_user_id_idx").on(table.userId),
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
    /** Better Auth's brute-force lockout: failed code attempts since the last success. */
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    /** Set by Better Auth when too many codes fail; verification is refused until then. */
    lockedUntil: timestamp("locked_until", { mode: "date", withTimezone: true }),
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
