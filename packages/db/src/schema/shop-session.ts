import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Shop-owned server-side login session; the browser receives only `id`. */
export const shopIdentitySession = pgTable(
  "shop_identity_session",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id"),
    sid: text("sid"),
    oauthState: text("oauth_state"),
    oauthNonce: text("oauth_nonce"),
    oauthCodeVerifier: text("oauth_code_verifier"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    invalidatedAt: timestamp("invalidated_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_identity_session_sid_idx").on(table.sid),
    index("shop_identity_session_subject_idx").on(table.subjectId),
    index("shop_identity_session_expires_idx").on(table.expiresAt),
  ],
);

/** Durable replay ledger for accepted Shop back-channel logout JTIs. */
export const shopLogoutTokenReplay = pgTable(
  "shop_logout_token_replay",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_logout_token_replay_expires_idx").on(table.expiresAt)],
);
