import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One Zoho Books organisation the platform may call (EU data centre). OAuth tokens are only ever
 * stored sealed (the AES-256-GCM `v1:` envelope that also protects Xero and Identity tokens); there
 * is no plaintext column. Constraints are in migration 0369.
 */
export const zohoBooksConnection = pgTable(
  "zoho_books_connection",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Zoho's organisation id: one row per Books organisation (legal entity). */
    organizationId: text("organization_id").notNull().unique(),
    /** Envelope of the long-lived refresh token. Never null: a connection without one is not stored. */
    refreshTokenSealed: text("refresh_token_sealed").notNull(),
    /** Envelope of the short-lived access token; null until the first refresh. */
    accessTokenSealed: text("access_token_sealed"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    connectionStatus: text("connection_status")
      .$type<"healthy" | "needs_reauth">()
      .notNull()
      .default("healthy"),
    /** A short code, never Zoho's response text: for example `zoho_books_invalid_grant`. */
    lastRefreshErrorCode: text("last_refresh_error_code"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "zoho_books_connection_refresh_token_sealed_envelope_chk",
      sql`${table.refreshTokenSealed} LIKE 'v1:%'`,
    ),
    check(
      "zoho_books_connection_access_token_sealed_envelope_chk",
      sql`${table.accessTokenSealed} IS NULL OR ${table.accessTokenSealed} LIKE 'v1:%'`,
    ),
    check(
      "zoho_books_connection_status_chk",
      sql`${table.connectionStatus} IN ('healthy', 'needs_reauth')`,
    ),
  ],
);
